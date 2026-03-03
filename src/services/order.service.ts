import { AppError } from '@/errors/app.error';
import {
	CreateOrderDTO,
	IOrder,
	OrderStatus,
	PaymentStatus,
	updatePaymentStatusDTO,
	updateShippingStatusDTO
} from '@/interfaces/order.interface';
import OrderModel from '@/models/Order.model';
import { PaymentService } from './Payment.service';
import { PaymentMethodService } from './paymentMethod.service';
import { ProductService } from './product.service';
import { ShippingMethodService } from './shippingMethod.service';

import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { UalaOrderStatus } from '@/interfaces/ualaWebhook.interface';
import { Role } from '@/interfaces/user.interface';
import { FilterQuery } from 'mongoose';

export class OrderService {
	private static generateOrderNumber(): string {
		const shortId = Math.random().toString(36).substring(2, 10).toUpperCase();
		return `REV-${shortId}`;
	}
	/**
	 * * Get order by id without select user field
	 * @param id string
	 * @returns order
	 */
	static async getOrderById(id: string) {
		try {
			if (!id) throw new AppError('Order ID is required', 'El ID de la orden es requerido', 400);
			const order = await OrderModel.findById(id).populate([
				{ path: 'items.product' },
			]).lean() as IOrder;
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			return order;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve order',
				'Error al intentar recuperar la orden',
				500
			);
		}
	}

	static async getFullyOrderBy(query: FilterQuery<IOrder>) {
		try {
			const order = await OrderModel.findOne(query).populate([
				{ path: 'items.product', select: '+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings' },
				{ path: 'user', select: 'name email profilePhoto role' }
			]) as IOrder;

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			return order;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve order',
				'Error al intentar recuperar la orden',
				500
			);
		}
	}

	/* 
	* * Get order by id fully populated (user and items.product)
	* @param id string
	* @returns order
	*/
	static async getOrderByIdFullyPopulated(id: string) {
		try {
			const order = await OrderModel.findById(id)
				.populate('user', 'name email')
				.populate('items.product', 'name price images');
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			return order;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve order',
				'Error al intentar recuperar la orden',
				500
			);
		}
	}

	/* 
	* * Update order status
	* @param id string
	* @param orderStatus PaymentStatus
	* @returns order fully populated
	*/
	static async updateOrderStatus(id: string, orderStatus: PaymentStatus) {
		try {
			const order = await OrderModel.findByIdAndUpdate(id, { orderStatus }, { new: true, runValidators: true }).populate([
				{ path: 'user', select: 'name email' },
				{ path: 'items.product', select: 'name price image' }
			]);
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			return order;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to update order status',
				'Error al intentar actualizar el estado de la orden',
				500
			);
		}
	}

	/* 
	* * Create order
	* @param data CreateOrderDTO
	* @param userId string
	* @returns order fully populated
	*/
	static async createOrder(data: CreateOrderDTO, userId: string) {
		try {
			/* Validate user and order data */
			if (!userId)
				throw new AppError(
					'User ID is required to create an order',
					'El ID del usuario es requerido para crear una orden',
					401
				);
			if (!data || data.items.length === 0)
				throw new AppError(
					'Order items are required',
					'Los items de la orden son requeridos',
					401
				);

			const items = (await ProductService.getProductsByIds(data.items.map((item) => item._id)))
				.map((product) => {
					const itemInTheCart = data.items.find((e) => e._id === product._id.toString());
					if (!itemInTheCart) throw new AppError('Item not found', 'Item no encontrado', 404);
					return {
						data: product,
						variantSku: itemInTheCart.variantSku,
						quantity: itemInTheCart.quantity
					};
				});

			/* verifying variant stock */
			const variantItems = data.items.map(item => ({
				productId: item._id,
				variantSku: item.variantSku,
				quantity: item.quantity
			}));
			await ProductService.verifyVariantStock(variantItems);

			/* get shipping method */
			const shippingMethod = await ShippingMethodService.getShippingMethodBy({
				_id: data.shippingMethod._id
			});
			/* get payment method */
			const paymentMethod = await PaymentMethodService.getPaymentMethodById(
				data.paymentMethod._id
			);
			/* creating payment service instance */
			const paymentService = new PaymentService(
				items,
				paymentMethod.type,
				shippingMethod.cost
			);

			// Validar que el pago en efectivo solo sea permitido con pickup
			if (
				paymentMethod.type === PaymentType.CASH &&
				shippingMethod.type !== ShippingType.PICKUP
			) {
				throw new AppError(
					'Invalid payment method',
					'El pago en efectivo solo está disponible para retiro en punto de venta',
					400
				);
			}

			const finalCost = paymentService.getFinalCost();

			const status =
				shippingMethod.type === ShippingType.HOME_DELIVERY
					? OrderStatus.PROCESSING_SHIPPING
					: OrderStatus.PENDING;

			/* reducing variant stock */
			await ProductService.reduceVariantStock(variantItems);

			/* creating order in DB */
			const newOrder = await (await OrderModel.create(
				{
					user: userId,
					status,
					items: items.map((item) => {
						// Buscar la variante para generar el label
						const variant = item.data.variants?.find((v: any) => v.sku === item.variantSku);
						const variantLabel = variant?.attributes?.map((a: any) => a.value).join(' - ') || '';

						return {
							product: item.data._id,
							variantSku: item.variantSku,
							variantLabel,
							quantity: item.quantity,
							price: paymentMethod.type === PaymentType.CARD
								? item.data.prices.tarjeta_credito_debito
								: item.data.prices.efectivo_transferencia,
							productSnapshot: {
								brand: item.data.brand,
								model: item.data.model,
								image: item.data.images?.[0]?.url || ''
							}
						};
					}),
					shippingInfo: {
						type: shippingMethod.type,
						pickupPoint: data.shippingMethod.pickupPoint,
						cost: shippingMethod.cost
					},
					paymentInfo: {
						method: paymentMethod.type,
						amount: finalCost
					},
					total: finalCost,
					orderNumber: this.generateOrderNumber(),
					history: [{
						status: status,
						timestamp: new Date()
					}],
					earnings: PaymentService.theOrderIsPreferredPayment(paymentMethod.type)
						? paymentService.getEarnings()
						: 0
				}

			)).populate([
				{ path: 'user', select: 'name email' },
				{ path: 'items.product', select: 'brand model prices images' }
			])

			let extras;
			if (paymentMethod.type === PaymentType.CARD) {
				const { ualaOrder, error } = await paymentService.withUalaBiss(newOrder.id);
				newOrder.paymentInfo.transactionId = ualaOrder?.uuid || '';
				if (error) {
					throw new AppError(
						'Failed to create order',
						'Error al intentar crear la orden',
						500
					);
				}
				extras = ualaOrder;
			}

			return { order: newOrder, extras };
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create order', 'Error al intentar crear la orden', 500);
		}
	}
	/* 
	* * Get orders by user id
	* @param userId string
	* @param query {
	* 	status: string;
	* 	dateRange: string;
	* 	page: number;
	* 	limit: number;
	* }
	* @returns orders fully populated
	*/
	static async getOrdersByUserId(userId: string, query: {
		status: string;
		dateRange: string;
		page: number;
		limit: number;
	}) {
		if (!userId)
			throw new AppError(
				'User ID is required to fetch orders',
				'El ID del usuario es requerido para obtener las órdenes',
				400
			);
		try {
			const skip = (query.page - 1) * query.limit;
			const { status, dateRange, limit, page } = query
			// Construir filtros
			const filters: any = {
				user: userId
			};

			// Filtro por estado
			if (status) {
				filters.status = status;
			}

			// Filtro por rango de fechas
			if (dateRange) {
				const now = new Date();
				let startDate: Date;

				switch (dateRange) {
					case 'today':
						startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
						filters.createdAt = { $gte: startDate };
						break;

					case 'this_week':
						const startOfWeek = new Date(now);
						startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo
						startOfWeek.setHours(0, 0, 0, 0);
						filters.createdAt = { $gte: startOfWeek };
						break;

					case 'this_month':
						startDate = new Date(now.getFullYear(), now.getMonth(), 1);
						filters.createdAt = { $gte: startDate };
						break;

					case 'last_3_months':
						startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
						filters.createdAt = { $gte: startDate };
						break;

					case 'last_6_months':
						startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
						filters.createdAt = { $gte: startDate };
						break;

					case 'this_year':
						startDate = new Date(now.getFullYear(), 0, 1);
						filters.createdAt = { $gte: startDate };
						break;

					default:
						// 'all' o cualquier otro valor no aplica filtro de fecha
						break;
				}
			}


			const userOrders = await OrderModel.find(filters)
				.populate({
					path: 'items.product',
					select: 'brand model price images'
				})
				.sort({ createdAt: -1 }) // Ordenar por fecha de creación descendente
				.skip(skip)
				.limit(query.limit);
			const total = await OrderModel.countDocuments(filters);

			return {
				data: userOrders,
				pagination: {
					currentPage: page,
					totalPages: Math.ceil(total / limit),
					totalItems: total,
					itemsPerPage: limit
				},
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve user orders',
				'Error al intentar recuperar las órdenes del usuario',
				500
			);
		}
	}

	/* 
	* * Update payment status
	* @param data updatePaymentStatusDTO
	* @returns order fully populated
	*/
	static async updatePaymentStatus(data: updatePaymentStatusDTO) {
		if (!data.orderID)
			throw new AppError(
				'Order ID is required to update payment status',
				'El ID de la orden es requerido para actualizar el estado del pago',
				400
			);
		try {
			let order = await this.getOrderByIdFullyPopulated(data.orderID);
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			let newStatus: string;
			const isCard = order.paymentInfo.method === PaymentType.CARD;
			if (isCard) {
				if (!order.paymentInfo.transactionId)
					throw new AppError(
						'No transaction ID found for this order',
						'No se encontró ID de transacción para esta orden',
						400
					);

				const ualaOrder = await PaymentService.getOrderStatus(order.paymentInfo.transactionId);

				if (!ualaOrder.orderStatus || ualaOrder.error)
					throw new AppError(
						'Order not found',
						'transaccion no encontrada',
						404
					);

				newStatus =
					ualaOrder.orderStatus?.status === UalaOrderStatus.Aprobado
						? PaymentStatus.APPROVED
						: PaymentStatus.REJECTED;
			}
			order.paymentInfo.status = data.status;
			const orderUpdated = await order.save();
			return orderUpdated;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to update payment status',
				'Error al intentar actualizar el estado del pago',
				500
			);
		}
	}

	/* 
	* * Update order shipping status
	* @param data updateShippingStatusDTO
	* @returns order fully populated
	*/
	static async updateOrderShippingStatus(data: updateShippingStatusDTO) {
		if (!data.orderID)
			throw new AppError(
				'Order ID is required to update shipping status',
				'El ID de la orden es requerido para actualizar el estado del envío',
				400
			);
		try {
			const order = await OrderModel.findById(data.orderID)
				.populate([
					{ path: 'user', select: 'name email profilePhoto role' },
					{ path: 'items.product', select: 'name price images description category' }
				]).lean() as IOrder;

			if (!order) {
				throw new AppError('Order not found', 'Orden no encontrada', 404);
			}
			const oldStatus = order.status;
			order.status = data.status;

			if (oldStatus !== order.status) {
				order.history.push({
					status: order.status,
					timestamp: new Date()
				});

				if (order.status === OrderStatus.SHIPPED) {
					order.shippingInfo.shippedAt = new Date();
				}

				if (order.status === OrderStatus.DELIVERED) {
					order.shippingInfo.deliveredAt = new Date();

					if (order.paymentInfo.method === PaymentType.CASH) {
						order.paymentInfo.status = PaymentStatus.APPROVED;
						order.paymentInfo.paymentDate = new Date();
					}

					if (order.paymentInfo.method !== PaymentType.CASH && order.paymentInfo.status === PaymentStatus.PENDING) {
						throw new AppError(
							"Invalid action",
							"No podés entregar un pedido que no tiene el pago aprobado (Transferencia/Tarjeta)",
							400
						);
					}
				}
			}

			const orderUpdated = await order.save();

			return orderUpdated;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to update shipping status',
				'Error al intentar actualizar el estado del envío',
				500
			);
		}
	}

	/* 
	* * Confirm card payment and calculate earnings
	* @param orderID string
	* @param status UalaOrderStatus
	* @returns order fully populated
	*/
	static async confirmCardPayment(orderID: string, status: UalaOrderStatus) {
		try {
			const order = await OrderModel.findById(orderID)
				.populate([
					{ path: 'user', select: 'name email' },
					{ path: 'items.product', select: '+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas' }
				]);

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			// Update payment status
			order.paymentInfo.status = status === UalaOrderStatus.Aprobado
				? PaymentStatus.APPROVED
				: PaymentStatus.REJECTED;

			// If approved, calculate earnings based on installments
			if (order.paymentInfo.status === PaymentStatus.APPROVED) {
				if (!order.paymentInfo.transactionId) {
					console.error('Transaction ID missing for approved card order:', orderID);
					// Fallback to default earnings or log error? Continuing with 0 or conservative.
				} else {
					const { orderStatus, error } = await PaymentService.getOrderStatus(order.paymentInfo.transactionId);
					if (!error && orderStatus) {
						// Extract installments from Uala response
						// Assuming structure: customer.card.installments.number (based on user request)
						const installments = (orderStatus as any).customer?.card?.installments?.number || 1;

						// Map order items to PaymentService structure
						const itemsForPaymentService = order.items.map(item => ({
							data: item.product as any, // Cast to any or IProduct if imported
							quantity: item.quantity
						}));

						const paymentService = new PaymentService(
							itemsForPaymentService,
							PaymentType.CARD,
							order.shippingInfo.cost
						);

						order.earnings = paymentService.getEarnings(installments);
					}
				}
				order.paymentInfo.paymentDate = new Date();
			}

			await order.save();
			return order;

		} catch (error) {
			console.error('Error confirming card payment:', error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to confirm card payment',
				'Error al confirmar el pago con tarjeta',
				500
			);
		}
	}

	/* 
	* * Get all orders
	* @param role admin
	* @param query 
	* @returns all orders
	*/
	static async getAllOrders(
		role: Role,
		query: {
			status: string;
			userId: string;
			dateRange: string;
			page: string | number;
			limit: string | number;
		}
	) {
		if (query.userId === 'undefined')
			throw new AppError('Invalid userId filter', 'El filtro de userId no es válido', 400);

		if (role !== 'admin') {
			throw new AppError('Unauthorized access', 'Acceso no autorizado', 403);
		}
		const page = parseInt(query.page as string) || 1;
		const limit = parseInt(query.limit as string) || 10;
		const skip = (page - 1) * limit;

		// Construir filtros
		const filters: any = {};

		// Filtro por estado
		if (query.status) {
			filters.status = query.status;
		}

		// Filtro por usuario
		if (query.userId) {
			filters.user = query.userId;
		}

		// Filtro por rango de fechas
		if (query.dateRange) {
			const now = new Date();
			let startDate: Date;

			switch (query.dateRange) {
				case 'today':
					startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
					filters.createdAt = { $gte: startDate };
					break;

				case 'this_week':
					const startOfWeek = new Date(now);
					startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo
					startOfWeek.setHours(0, 0, 0, 0);
					filters.createdAt = { $gte: startOfWeek };
					break;

				case 'this_month':
					startDate = new Date(now.getFullYear(), now.getMonth(), 1);
					filters.createdAt = { $gte: startDate };
					break;

				case 'last_3_months':
					startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
					filters.createdAt = { $gte: startDate };
					break;

				case 'last_6_months':
					startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
					filters.createdAt = { $gte: startDate };
					break;

				case 'this_year':
					startDate = new Date(now.getFullYear(), 0, 1);
					filters.createdAt = { $gte: startDate };
					break;

				default:
					// 'all' o cualquier otro valor no aplica filtro de fecha
					break;
			}
		}
		try {
			// Obtener órdenes con Paginación y populate mejorado
			const orders = await OrderModel.find(filters)
				.populate('user', 'name email profilePhoto role')
				.populate({
					path: 'items.product',
					select: 'name price images description category'
				})
				.sort({ createdAt: -1 }) // Ordenar por fecha de creación descendente
				.skip(skip)
				.limit(limit);

			// Contar total de órdenes con los mismos filtros
			const total = await OrderModel.countDocuments(filters);

			// Estadísticas adicionales (opcional)
			const stats = await OrderModel.aggregate([
				{ $match: filters },
				{
					$group: {
						_id: '$status',
						count: { $sum: 1 },
						totalAmount: { $sum: '$total' }
					}
				}
			]);

			const response = {
				data: orders,
				pagination: {
					currentPage: page,
					totalPages: Math.ceil(total / limit),
					totalItems: total,
					itemsPerPage: limit
				},
				// Incluir estadísticas si se desea
				stats: stats.reduce((acc, stat) => {
					acc[stat._id] = {
						count: stat.count,
						totalAmount: stat.totalAmount
					};
					return acc;
				}, {} as any),
				filters: {
					status: query.status || 'all',
					userId: query.userId || null,
					dateRange: query.dateRange || 'all'
				}
			};
			return response;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve orders',
				'Error al intentar recuperar las órdenes',
				500
			);
		}
	}

	/* 
	* * Cancel order
	* @param id order ID
	* @param userID user ID
	* @param role admin
	* @returns order fully populated
	*/
	static async cancelOrder(id: string, userID: string, role: Role) {
		if (!id)
			throw new AppError(
				'Order ID is required to cancel an order',
				'El ID de la orden es requerido para cancelarla',
				400
			);
		if (!userID)
			throw new AppError(
				'User ID is required to cancel an order',
				'El ID del usuario es requerido para cancelar la orden',
				400
			);
		if (role !== Role.admin)
			throw new AppError('Unauthorized access', 'Acceso no autorizado', 403);
		try {
			const order = await this.getOrderById(id);
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			// verify if the user is the owner of the order or an admin if is admin can cancel the order
			if (order.user.toString() !== userID && role !== 'admin') {
				throw new AppError(
					'You can only cancel your own orders',
					'Solo puedes cancelar tus propias órdenes',
					403
				);
			}

			// only pending orders can be cancelled
			if (order.status !== OrderStatus.PENDING) {
				throw new AppError(
					'Only pending orders can be cancelled',
					'Solo se pueden cancelar órdenes pendientes',
					400
				);
			}

			// Actualizar estado a cancelado
			order.status = OrderStatus.CANCELLED;
			order.history.push({
				status: OrderStatus.CANCELLED,
				timestamp: new Date()
			});

			order.paymentInfo.status = PaymentStatus.CANCELLED;
			await order.save();

			// restore variant stock
			await ProductService.restoreVariantStock(
				order.items.map((item: any) => ({
					product: item.product,
					variantSku: item.variantSku,
					quantity: item.quantity
				}))
			);
			const updatedOrder = await this.getOrderByIdFullyPopulated(id);
			return updatedOrder;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('failed to cancel order', 'Error al intentar cancelar la orden', 500);
		}
	}

	/* 
	* * Get order stats
	* @param role admin
	* @returns order stats
	*/
	static async getOrderStats(role: Role) {
		/* Verify role exist and its Admin */
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
				OrderModel.countDocuments(),
				OrderModel.countDocuments({ status: OrderStatus.PENDING }),
				OrderModel.countDocuments({ status: OrderStatus.PROCESSING_SHIPPING }),
				OrderModel.countDocuments({ status: OrderStatus.SHIPPED }),
				OrderModel.countDocuments({ status: OrderStatus.DELIVERED }),
				OrderModel.countDocuments({ status: OrderStatus.CANCELLED }),
				OrderModel.aggregate([
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
}
