import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { Role } from '@/interfaces/user.interface';
import {
	GetOrderStatsResponse,
	OrderStatus,
	PaymentStatus,
	SaleType
} from '@/interfaces/order.interface';
import { ADMIN_PRICE_SELECT } from './orderPayment.service';

export class OrderStatsService {
	/**
	 * Métricas globales de órdenes para el dashboard del admin
	 */
	static async getOrderStats(models: TenantModels, role: Role): Promise<GetOrderStatsResponse> {
		if (!role || role !== Role.admin)
			throw new AppError('Unauthorized access', 'Acceso no autorizado', 403);
		try {
			const [
				totalOrders,
				pendingOrders,
				processingOrders,
				shippedOrders,
				deliveredOrders,
				cancelledOrders,
				totalRevenue
			] = await Promise.all([
				models.Order.countDocuments(),
				models.Order.countDocuments({ status: OrderStatus.PENDING_PAYMENT }),
				models.Order.countDocuments({ status: OrderStatus.PROCESSING_SHIPPING }),
				models.Order.countDocuments({ status: OrderStatus.SHIPPED }),
				models.Order.countDocuments({ status: OrderStatus.DELIVERED }),
				models.Order.countDocuments({ status: OrderStatus.CANCELLED }),
				models.Order.aggregate([
					{ $match: { status: { $ne: OrderStatus.CANCELLED } } },
					{ $group: { _id: null, total: { $sum: '$total' } } }
				])
			]);
			return {
				totalOrders,
				pendingOrders,
				processingOrders,
				shippedOrders,
				deliveredOrders,
				cancelledOrders,
				totalRevenue
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error fetching order', 'Error al intentar recuperar las órdenes', 500);
		}
	}

	/**
	 * Estadísticas del día en la tienda física/online
	 */
	static async getDailyStats(models: TenantModels, dateParam?: string) {
		try {
			const targetDate = dateParam ? new Date(dateParam) : new Date();

			const startOfDay = new Date(targetDate);
			startOfDay.setHours(0, 0, 0, 0);

			const endOfDay = new Date(targetDate);
			endOfDay.setHours(23, 59, 59, 999);

			// Consultar todas las órdenes del día
			const dailyOrders = await models.Order.find({
				createdAt: { $gte: startOfDay, $lte: endOfDay }
			})
				.select(ADMIN_PRICE_SELECT)
				.populate([
					{ path: 'user', select: 'name email' },
					{ path: 'items.productSnapshot.providerSnapshot', strictPopulate: false }
				])
				.lean();

			let totalRevenue = 0;
			let totalEarnings = 0;
			let totalCostPrice = 0;
			let refundedRevenue = 0;
			let refundedCount = 0;
			const incomeByMethod: Record<string, number> = {};
			let localSalesCount = 0;
			let onlineSalesCount = 0;

			// 24 slots horarios
			const hourlyMap = new Map<number, { hour: number; revenue: number; count: number }>();
			for (let h = 0; h < 24; h++) {
				hourlyMap.set(h, { hour: h, revenue: 0, count: 0 });
			}

			const salesWithDetails: any[] = [];

			for (const order of dailyOrders) {
				const isRefunded =
					order.status === OrderStatus.CANCELLED ||
					order.paymentInfo?.status === PaymentStatus.CANCELLED ||
					order.paymentInfo?.status === PaymentStatus.REJECTED;

				const isApproved =
					order.paymentInfo?.status === PaymentStatus.APPROVED &&
					order.status !== OrderStatus.CANCELLED;

				if (isRefunded) {
					refundedCount++;
					refundedRevenue += order.finance?.total || 0;
				} else if (isApproved) {
					totalRevenue += order.finance?.total || 0;
					totalEarnings += Number(order.finance?.earnings) || 0;

					if (order.saleType === SaleType.LOCAL) localSalesCount++;
					else onlineSalesCount++;

					// Horas
					const orderHour = new Date(order.createdAt).getHours();
					const currentSlot = hourlyMap.get(orderHour) || {
						hour: orderHour,
						revenue: 0,
						count: 0
					};
					currentSlot.revenue += order.finance?.total || 0;
					currentSlot.count++;
					hourlyMap.set(orderHour, currentSlot);

					// Métodos de pago
					if (order.splitPayments && order.splitPayments.length > 0) {
						order.splitPayments.forEach((sp: any) => {
							incomeByMethod[sp.method] = (incomeByMethod[sp.method] || 0) + sp.amount;
						});
					} else {
						const method = order.paymentInfo?.method || 'unknown';
						incomeByMethod[method] = (incomeByMethod[method] || 0) + (order.finance?.total || 0);
					}
				}

				// Items con detalle
				const itemsWithDetail: any[] = [];
				for (const item of order.items as any[]) {
					const snapshot = item.productSnapshot;
					const costPriceValue =
						item.costPriceSnapshot?.inARS ?? snapshot?.prices?.costPrice?.inARS ?? 0;
					if (isApproved) {
						totalCostPrice += costPriceValue * item.quantity;
					}

					itemsWithDetail.push({
						productName: `${snapshot?.brand ?? ''} ${snapshot?.model ?? ''}`.trim(),
						image: snapshot?.image ?? '',
						quantity: item.quantity,
						unitPrice: item.price,
						costPrice: costPriceValue,
						variant: item.variantSnapshot
							? `${item.variantSnapshot.size || ''} ${item.variantSnapshot.color?.name || ''}`.trim()
							: '',
						provider: snapshot?.providerSnapshot
							? { name: snapshot.providerSnapshot.name ?? 'Sin proveedor' }
							: null
					});
				}

				const orderUser = order.user as any;
				const buyer = orderUser
					? { name: orderUser.name, email: orderUser.email }
					: order.buyerData
					? {
							name: `${order.buyerData.firstName} ${order.buyerData.lastName}`,
							email: order.buyerData.email
					  }
					: null;

				salesWithDetails.push({
					orderId: (order as any)._id.toString(),
					orderNumber: order.orderNumber,
					createdAt: order.createdAt,
					saleType: order.saleType,
					status: order.status,
					paymentStatus: order.paymentInfo?.status,
					total: order.finance?.total || 0,
					earnings: Number(order.finance?.earnings) || 0,
					paymentMethod: order.paymentInfo?.method,
					buyer,
					items: itemsWithDetail
				});
			}

			const hourlyActivity = Array.from(hourlyMap.values());
			salesWithDetails.sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);

			const totalSalesCount = localSalesCount + onlineSalesCount;
			const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
			const marginPercentage = totalRevenue > 0 ? (totalEarnings / totalRevenue) * 100 : 0;

			return {
				date: startOfDay.toISOString().split('T')[0],
				totalRevenue,
				totalEarnings,
				totalCostPrice,
				averageTicket,
				marginPercentage,
				salesCount: {
					total: totalSalesCount,
					local: localSalesCount,
					online: onlineSalesCount
				},
				refunds: {
					total: refundedRevenue,
					count: refundedCount
				},
				incomeByMethod,
				revenueByMethod: incomeByMethod,
				hourlyActivity,
				hourlyBreakdown: hourlyActivity,
				salesWithDetails
			};
		} catch (error) {
			console.error(error);
			throw new AppError(
				'Failed to get daily stats',
				'Error al obtener las estadísticas del día',
				500
			);
		}
	}

	/**
	 * Estadísticas de ventas por rango (día, semana, mes, año).
	 * Incluye órdenes aprobadas, métricas de cancelaciones/reembolsos, top productos y KPIs avanzados.
	 */
	static async getSalesStats(
		models: TenantModels,
		range: 'day' | 'week' | 'month' | 'year',
		dateParam?: string,
		currency: 'USD' | 'ARS' = 'ARS'
	) {
		try {
			const targetDate = dateParam ? new Date(dateParam) : new Date();

			let from: Date;
			let to: Date;

			switch (range) {
				case 'day':
					from = new Date(targetDate);
					from.setHours(0, 0, 0, 0);
					to = new Date(targetDate);
					to.setHours(23, 59, 59, 999);
					break;
				case 'week': {
					from = new Date(targetDate);
					const dayOfWeek = from.getDay();
					from.setDate(from.getDate() - dayOfWeek);
					from.setHours(0, 0, 0, 0);
					to = new Date(from);
					to.setDate(to.getDate() + 6);
					to.setHours(23, 59, 59, 999);
					break;
				}
				case 'month':
					from = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
					to = new Date(
						targetDate.getFullYear(),
						targetDate.getMonth() + 1,
						0,
						23,
						59,
						59,
						999
					);
					break;
				case 'year':
					from = new Date(targetDate.getFullYear(), 0, 1, 0, 0, 0, 0);
					to = new Date(targetDate.getFullYear(), 11, 31, 23, 59, 59, 999);
					break;
			}

			// Consultar todas las órdenes del rango
			const allRangeOrders = await models.Order.find({
				createdAt: { $gte: from, $lte: to }
			})
				.select(ADMIN_PRICE_SELECT)
				.populate([
					{ path: 'user', select: 'name email' },
					{ path: 'items.productSnapshot.providerSnapshot', strictPopulate: false }
				])
				.lean();

			let totalRevenue = 0;
			let totalEarnings = 0;
			let totalCostPrice = 0;
			let localSalesCount = 0;
			let onlineSalesCount = 0;
			let refundedCount = 0;
			let refundedTotal = 0;
			const revenueByMethod: Record<string, number> = {};

			const breakdownMap = new Map<
				string,
				{ revenue: number; earnings: number; ordersCount: number }
			>();
			const salesWithDetails: any[] = [];
			const productsMap = new Map<
				string,
				{
					productName: string;
					image: string;
					quantity: number;
					revenue: number;
					earnings: number;
				}
			>();

			for (const order of allRangeOrders) {
				const isRefunded =
					order.status === OrderStatus.CANCELLED ||
					order.paymentInfo?.status === PaymentStatus.CANCELLED ||
					order.paymentInfo?.status === PaymentStatus.REJECTED;

				const isApproved =
					order.paymentInfo?.status === PaymentStatus.APPROVED &&
					order.status !== OrderStatus.CANCELLED;

				if (isRefunded) {
					refundedCount++;
					refundedTotal += order.finance?.total || 0;
				}

				if (isApproved) {
					totalRevenue += order.finance?.total || 0;
					totalEarnings += Number(order.finance?.earnings) || 0;

					if (order.saleType === SaleType.LOCAL) localSalesCount++;
					else onlineSalesCount++;

					if (order.splitPayments && order.splitPayments.length > 0) {
						order.splitPayments.forEach((sp: any) => {
							revenueByMethod[sp.method] = (revenueByMethod[sp.method] || 0) + sp.amount;
						});
					} else {
						const method = order.paymentInfo?.method || 'unknown';
						revenueByMethod[method] = (revenueByMethod[method] || 0) + (order.finance?.total || 0);
					}

					// Breakdown por día
					const dayKey = new Date(order.createdAt).toISOString().split('T')[0];
					const existing = breakdownMap.get(dayKey) || {
						revenue: 0,
						earnings: 0,
						ordersCount: 0
					};
					breakdownMap.set(dayKey, {
						revenue: existing.revenue + (order.finance?.total || 0),
						earnings: existing.earnings + (Number(order.finance?.earnings) || 0),
						ordersCount: existing.ordersCount + 1
					});
				}

				// Items
				const itemsWithDetail: any[] = [];
				for (const item of order.items as any[]) {
					const snapshot = item.productSnapshot;
					const costPriceValue =
						currency === 'USD'
							? item.costPriceSnapshot?.inUSD ?? snapshot?.prices?.costPrice?.inUSD ?? 0
							: item.costPriceSnapshot?.inARS ?? snapshot?.prices?.costPrice?.inARS ?? 0;

					if (isApproved) {
						totalCostPrice += costPriceValue * item.quantity;

						// Top products
						const prodName =
							`${snapshot?.brand ?? ''} ${snapshot?.model ?? ''}`.trim() || 'Producto';
						const prodKey = snapshot?._id?.toString() || prodName;
						const itemEarnings = (item.price - costPriceValue) * item.quantity;
						const existingProd = productsMap.get(prodKey) || {
							productName: prodName,
							image: snapshot?.image || '',
							quantity: 0,
							revenue: 0,
							earnings: 0
						};
						existingProd.quantity += item.quantity;
						existingProd.revenue += item.price * item.quantity;
						existingProd.earnings += itemEarnings;
						productsMap.set(prodKey, existingProd);
					}

					itemsWithDetail.push({
						productName: `${snapshot?.brand ?? ''} ${snapshot?.model ?? ''}`.trim(),
						image: snapshot?.image ?? '',
						quantity: item.quantity,
						unitPrice: item.price,
						costPrice: costPriceValue,
						variant: item.variantSnapshot
							? `${item.variantSnapshot.size || ''} ${
									item.variantSnapshot.color?.name || ''
							  }`.trim()
							: '',
						provider: snapshot?.providerSnapshot
							? { name: snapshot.providerSnapshot.name ?? 'Sin proveedor' }
							: null
					});
				}

				const orderUser = order.user as any;
				const buyer = orderUser
					? { name: orderUser.name, email: orderUser.email }
					: order.buyerData
					? {
							name: `${order.buyerData.firstName} ${order.buyerData.lastName}`,
							email: order.buyerData.email
					  }
					: null;

				salesWithDetails.push({
					orderId: (order as any)._id.toString(),
					orderNumber: order.orderNumber,
					createdAt: order.createdAt,
					saleType: order.saleType,
					status: order.status,
					paymentStatus: order.paymentInfo?.status,
					total: order.finance?.total || 0,
					earnings: Number(order.finance?.earnings) || 0,
					paymentMethod: order.paymentInfo?.method,
					buyer,
					items: itemsWithDetail
				});
			}

			const dailyBreakdown = Array.from(breakdownMap.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([date, data]) => ({ date, ...data }));

			salesWithDetails.sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			);

			// Top products ordenados por cantidad vendida
			const topProducts = Array.from(productsMap.values())
				.sort((a, b) => b.quantity - a.quantity)
				.slice(0, 8);

			const approvedCount = localSalesCount + onlineSalesCount;
			const averageTicket = approvedCount > 0 ? totalRevenue / approvedCount : 0;
			const averageMargin = totalRevenue > 0 ? (totalEarnings / totalRevenue) * 100 : 0;

			return {
				range,
				from: from.toISOString(),
				to: to.toISOString(),
				currency,
				totalRevenue,
				totalEarnings,
				totalCostPrice,
				averageTicket,
				averageMargin,
				salesCount: {
					total: approvedCount,
					local: localSalesCount,
					online: onlineSalesCount
				},
				refunds: {
					total: refundedTotal,
					count: refundedCount
				},
				revenueByMethod,
				dailyBreakdown,
				topProducts,
				salesWithDetails
			};
		} catch (error) {
			console.error(error);
			throw new AppError(
				'Failed to get sales stats',
				'Error al obtener las estadísticas de ventas',
				500
			);
		}
	}
}
