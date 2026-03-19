import { AppError } from '@/errors/app.error';
import {
	CreateOrderDTO,
	IOrderDocument,
	OrderStatus,
	PaymentStatus,
	updatePaymentStatusDTO,
	updateShippingStatusDTO,
	CreateOrderResponse,
	GetOrdersByUserResponse,
	GetAllOrdersResponse,
	GetOrderStatsResponse,
	CreateOrderExtras,
	SaleType,
	ISplitPayment
} from '@/interfaces/order.interface';
import { EcommerceService } from './ecommerce.service';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { PaymentService } from './Payment.service';
import { PaymentMethodService } from './paymentMethod.service';
import { ProductService } from './product.service';
import { ShippingMethodService } from './shippingMethod.service';
import { MercadoPagoService } from './mercadopago.service';

import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { UalaOrderStatus } from '@/interfaces/ualaWebhook.interface';
import { Role } from '@/interfaces/user.interface';
import { FilterQuery } from 'mongoose';
import { TenantModels } from '@/config/modelRegistry';

export class OrderService {
	private static generateOrderNumber(): string {
		const shortId = Math.random().toString(36).substring(2, 10).toUpperCase();
		return `REV-${shortId}`;
	}

	static async getOrderById(models: TenantModels, id: string): Promise<IOrderDocument> {
		try {
			if (!id) throw new AppError('Order ID is required', 'El ID de la orden es requerido', 400);
			const order = await models.Order.findById(id).populate([
				{ path: 'items.product' },
			]) as IOrderDocument;
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

	static async getFullyOrderBy(models: TenantModels, query: FilterQuery<IOrderDocument>) {
		try {
			const order = await models.Order.findOne(query).populate([
				{ path: 'items.product', select: '+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings' },
				{ path: 'user', select: 'name email profilePhoto role' }
			]) as IOrderDocument;

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

	static async getOrderByIdFullyPopulated(models: TenantModels, id: string): Promise<IOrderDocument> {
		try {
			const order = await models.Order.findById(id)
				.populate('user', 'name email')
				.populate('items.product', 'name price images') as IOrderDocument;
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

	static async updateOrderStatus(models: TenantModels, id: string, orderStatus: PaymentStatus) {
		try {
			const order = await models.Order.findByIdAndUpdate(id, { orderStatus }, { new: true, runValidators: true }).populate([
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

	static async createOrder(models: TenantModels, data: CreateOrderDTO, userId: string, tenantSlug: string, baseUrl: string): Promise<CreateOrderResponse> {
		try {
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

			const items = (await ProductService.getProductsByIds(models, data.items.map((item) => item._id)))
				.map((product) => {
					const itemInTheCart = data.items.find((e) => e._id === product._id.toString());
					if (!itemInTheCart) throw new AppError('Item not found', 'Item no encontrado', 404);
					return {
						data: product,
						variantSku: itemInTheCart.sku || '',
						quantity: itemInTheCart.quantity
					};
				});

			/* verifying variant stock */
			const variantItems = data.items.map(item => ({
				_id: item._id,
				sku: item.sku || '',
				quantity: item.quantity
			}));
			await ProductService.verifyVariantStock(models, variantItems);

			/* get shipping method */
			const shippingMethod = await ShippingMethodService.getShippingMethodBy(models, {
				_id: data.shippingMethod._id
			});
			/* get payment method */
			let paymentMethod;
			if (data.paymentMethod._id === 'mercadopago_gateway') {
				paymentMethod = {
					type: data.paymentMethod.type,
					name: data.paymentMethod.type === PaymentType.CARD ? 'Tarjeta de crédito / débito' : 'Mercado Pago'
				};
			} else {
				try {
					paymentMethod = await PaymentMethodService.getPaymentMethodById(models,
						data.paymentMethod._id
					);
				} catch (error) {
					// Fallback: buscar por tipo si el ID falla o es inválido (según requerimiento del usuario)
					paymentMethod = await PaymentMethodService.getPaymentMethodBy(models, {
						type: data.paymentMethod.type
					});
				}
			}
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
			await ProductService.reduceVariantStock(models, variantItems);

			/* creating order in DB */
			const newOrder = await (await models.Order.create(
				{
					user: userId,
					status,
					items: items.map((item) => {
						const variant = item.data.variants?.find((v: any) => v.sku === item.variantSku);
						const variantLabel = variant?.attributes?.map((a: any) => a.value).join(' - ') || '';

						return {
							product: item.data._id,
							variantSku: item.variantSku,
							variantLabel,
							quantity: item.quantity,
							price: (paymentMethod.type === PaymentType.CARD || paymentMethod.type === PaymentType.TICKET)
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

			let extras: CreateOrderExtras | undefined;
			if (paymentMethod.type === PaymentType.CARD || paymentMethod.type === PaymentType.TICKET) {
				const config = await EcommerceService.getConfig(models);

				const user = await models.User.findById(userId);

				// Prioridad a MercadoPago si está activo y tenemos los datos necesarios
				if (config.paymentGateways.mercadopago.active && data.mercadopagoData) {
					const { result, error } = await paymentService.withMercadoPago(
						newOrder.id,
						models,
						finalCost,
						{
							email: user?.email || '',
							first_name: user?.name.split(' ')[0],
							last_name: user?.name.split(' ').slice(1).join(' '),
							identification: data.mercadopagoData.identification
						},
						data.mercadopagoData,
						tenantSlug,
						baseUrl
					);

					if (error || !result) {
						throw new AppError('Failed to process MercadoPago payment', error || 'Error al procesar el pago de MercadoPago', 500);
					}

					newOrder.paymentInfo.transactionId = String(result.id);
					newOrder.paymentInfo.mercadopagoData = result;

					// Si el pago es exitoso
					if (result.status === 'processed' || result.status === 'approved') {
						newOrder.paymentInfo.status = PaymentStatus.APPROVED;
						newOrder.paymentInfo.paymentDate = new Date();
						newOrder.history.push({
							status: OrderStatus.PENDING,
							timestamp: new Date(),
							note: 'Pago acreditado automáticamente vía Checkout API'
						});

						// Cálculo de ganancias preliminar
						const mpConfig = config.paymentGateways.mercadopago;
						const installments = data.mercadopagoData.installments;
						const totalWithTaxes = finalCost / 1.21;
						const commission = mpConfig.baseCommission;
						const cft = installments <= 3 ? mpConfig.cft3cuotas : mpConfig.cft6Cuotas;
						const totalCost = totalWithTaxes * (1 - (commission + cft / 100));
						newOrder.earnings = finalCost - totalCost;
					}

					extras = {
						id: result.id,
						status: result.status,
						status_detail: result.status_detail,
						provider: EcommercePaymentProviders.MERCADOPAGO,
						ticket_url: result.transaction_details?.external_resource_url ||
							result.point_of_interaction?.transaction_data?.ticket_url
					};
				} else {
					// Fallback a Ualá
					const { ualaOrder, error } = await paymentService.withUalaBiss(newOrder.id);
					if (error || !ualaOrder) {
						throw new AppError('Failed to create Ualá order', 'Error al generar la orden de Ualá', 500);
					}
					newOrder.paymentInfo.transactionId = ualaOrder.uuid || '';
					newOrder.paymentInfo.ualaOrderStatus = ualaOrder as any;
					extras = {
						...ualaOrder,
						provider: EcommercePaymentProviders.UALA
					};
				}

				// Guardar el transactionId en la orden
				await newOrder.save();
			} else {
				// Es un pago MANUAL (Consolidado: Alias, Transferencia, Efectivo)
				extras = {
					provider: 'manual',
					name: paymentMethod.name || 'Manual',
					instructions: paymentMethod.description || 'Pendiente de confirmación manual',
					status: 'waiting_confirmation'
				};

				newOrder.paymentInfo.status = PaymentStatus.PENDING;
				await newOrder.save();
			}

			return { order: newOrder, extras };
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create order', 'Error al intentar crear la orden', 500);
		}
	}

	static async getOrdersByUserId(models: TenantModels, userId: string, query: {
		status: string;
		dateRange: string;
		page: number;
		limit: number;
	}): Promise<GetOrdersByUserResponse> {
		if (!userId)
			throw new AppError(
				'User ID is required to fetch orders',
				'El ID del usuario es requerido para obtener las órdenes',
				400
			);
		try {
			const skip = (query.page - 1) * query.limit;
			const { status, dateRange, limit, page } = query
			const filters: any = {
				user: userId
			};

			if (status) {
				filters.status = status;
			}

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
						startOfWeek.setDate(now.getDate() - now.getDay());
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
						break;
				}
			}

			const userOrders = await models.Order.find(filters)
				.populate({
					path: 'items.product',
					select: 'brand model price images'
				})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(query.limit);
			const total = await models.Order.countDocuments(filters);

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

	static async updatePaymentStatus(models: TenantModels, data: updatePaymentStatusDTO) {
		if (!data.orderID)
			throw new AppError(
				'Order ID is required to update payment status',
				'El ID de la orden es requerido para actualizar el estado del pago',
				400
			);
		try {
			let order = await this.getOrderByIdFullyPopulated(models, data.orderID);
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

	static async updateOrderShippingStatus(models: TenantModels, data: updateShippingStatusDTO) {
		if (!data.orderID)
			throw new AppError(
				'Order ID is required to update shipping status',
				'El ID de la orden es requerido para actualizar el estado del envío',
				400
			);
		try {
			const order = await models.Order.findById(data.orderID)
				.populate([
					{ path: 'user', select: 'name email profilePhoto role' },
					{ path: 'items.product', select: 'name price images description category' }
				]) as IOrderDocument;

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

	static async confirmCardPayment(models: TenantModels, orderID: string, status: UalaOrderStatus) {
		try {
			const order = await models.Order.findById(orderID)
				.populate([
					{ path: 'user', select: 'name email' },
					{ path: 'items.product', select: '+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas' }
				]);

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			order.paymentInfo.status = status === UalaOrderStatus.Aprobado
				? PaymentStatus.APPROVED
				: PaymentStatus.REJECTED;

			if (order.paymentInfo.status === PaymentStatus.APPROVED) {
				if (!order.paymentInfo.transactionId) {
					console.error('Transaction ID missing for approved card order:', orderID);
				} else {
					const { orderStatus, error } = await PaymentService.getOrderStatus(order.paymentInfo.transactionId);
					if (!error && orderStatus) {
						const installments = (orderStatus as any).customer?.card?.installments?.number || 1;

						const itemsForPaymentService = order.items.map(item => ({
							data: item.product as any,
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

	static async confirmMercadoPagoPayment(models: TenantModels, orderId: string, paymentId: string) {
		try {
			const config = await EcommerceService.getConfig(models);
			const mpConfig = config.paymentGateways.mercadopago;

			const mpPayment = await MercadoPagoService.getPaymentStatus(mpConfig.accessToken, paymentId);
			const order = await models.Order.findById(orderId).populate([
				{ path: 'user', select: 'name email' },
				{ path: 'items.product', select: '+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.cft3cuotas' }
			]) as IOrderDocument;

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			// Actualizar estado del pago
			order.paymentInfo.status = mpPayment.status === 'approved'
				? PaymentStatus.APPROVED
				: PaymentStatus.REJECTED;

			if (order.paymentInfo.status === PaymentStatus.APPROVED) {
				order.paymentInfo.paymentDate = new Date();
				order.paymentInfo.transactionId = paymentId; // Guardamos el ID del pago real
				order.paymentInfo.mercadopagoData = mpPayment; // Guardamos la info del pago

				// Calcular ganancias dinámicas basadas en cuotas si MP nos da el dato
				// Para tickets, installments suele ser 0 o 1, PaymentService.getEarnings(0) usará la ganancia de ticket
				const installments = mpPayment.payment_type_id === 'ticket' ? 0 : (mpPayment.installments || 1);

				const itemsForPaymentService = order.items.map(item => ({
					data: item.product as any,
					quantity: item.quantity
				}));

				const paymentService = new PaymentService(
					itemsForPaymentService,
					PaymentType.CARD,
					order.shippingInfo.cost
				);

				order.earnings = paymentService.getEarnings(installments);
			}

			await order.save();
			return order;
		} catch (error) {
			console.error('Error in confirmMercadoPagoPayment:', error);
			throw error;
		}
	}

	static async getAllOrders(
		models: TenantModels,
		role: Role,
		query: {
			status: string;
			userId: string;
			dateRange: string;
			page: string | number;
			limit: string | number;
		}
	): Promise<GetAllOrdersResponse> {
		if (query.userId === 'undefined')
			throw new AppError('Invalid userId filter', 'El filtro de userId no es válido', 400);

		if (role !== 'admin') {
			throw new AppError('Unauthorized access', 'Acceso no autorizado', 403);
		}
		const page = parseInt(query.page as string) || 1;
		const limit = parseInt(query.limit as string) || 10;
		const skip = (page - 1) * limit;

		const filters: any = {};

		if (query.status) {
			filters.status = query.status;
		}

		if (query.userId) {
			filters.user = query.userId;
		}

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
					startOfWeek.setDate(now.getDate() - now.getDay());
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
					break;
			}
		}
		try {
			const orders = await models.Order.find(filters)
				.populate('user', 'name email profilePhoto role')
				.populate({
					path: 'items.product',
					select: 'name price images description category'
				})
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit);

			const total = await models.Order.countDocuments(filters);

			const stats = await models.Order.aggregate([
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

	static async cancelOrder(models: TenantModels, id: string, userID: string, role: Role) {
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
			const order = await this.getOrderById(models, id);
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			if (order.user.toString() !== userID && role !== 'admin') {
				throw new AppError(
					'You can only cancel your own orders',
					'Solo puedes cancelar tus propias órdenes',
					403
				);
			}

			if (order.status !== OrderStatus.PENDING) {
				throw new AppError(
					'Only pending orders can be cancelled',
					'Solo se pueden cancelar órdenes pendientes',
					400
				);
			}

			order.status = OrderStatus.CANCELLED;
			order.history.push({
				status: OrderStatus.CANCELLED,
				timestamp: new Date()
			});

			order.paymentInfo.status = PaymentStatus.CANCELLED;
			await order.save();

			// restore variant stock
			await ProductService.restoreVariantStock(models,
				order.items.map((item: any) => ({
					product: item.product,
					variantSku: item.variantSku,
					quantity: item.quantity
				}))
			);
			const updatedOrder = await this.getOrderByIdFullyPopulated(models, id);
			return updatedOrder;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('failed to cancel order', 'Error al intentar cancelar la orden', 500);
		}
	}

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
				models.Order.countDocuments({ status: OrderStatus.PENDING }),
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

	// ==========================================
	// Métodos para POS / Ventas Locales
	// ==========================================

	/**
	 * Crea un pedido de venta local (mostrador). Se descuenta stock inmediatamente,
	 * y el pedido nace en estado DELIVERED (Entregado) y APPROVED (si el pago cubre el total).
	 */
	static async createLocalOrder(
		models: TenantModels,
		data: {
			items: { _id: string; sku?: string; quantity: number }[];
			splitPayments: ISplitPayment[];
			sellerId: string;
			userId?: string;
			notes?: string;
		}
	): Promise<IOrderDocument> {
		try {
			// 1. Obtener los productos seleccionados
			const itemsData = (await ProductService.getProductsByIds(models, data.items.map(i => i._id)))
				.map(product => {
					const orderItem = data.items.find(i => i._id === product._id.toString());
					if (!orderItem) throw new AppError('Item no encontrado', 'Uno de los productos no existe', 404);
					return {
						data: product,
						variantSku: orderItem.sku || '',
						quantity: orderItem.quantity
					};
				});

			// 2. Verificar stock
			const variantItems = data.items.map(item => ({
				_id: item._id,
				sku: item.sku || '',
				quantity: item.quantity
			}));
			await ProductService.verifyVariantStock(models, variantItems);

			// 3. Preparar items de la orden y calcular costo total
			let totalCost = 0;
			let totalEarnings = 0;

			const orderItems = itemsData.map(item => {
				const variant = item.data.variants?.find((v: any) => v.sku === item.variantSku);
				const variantLabel = variant?.attributes?.map((a: any) => a.value).join(' - ') || '';

				// precio base (efectivo/transferencia es lo más común para mostrador)
				const price = item.data.prices?.efectivo_transferencia || 0;
				// costo del producto para calcular la ganancia
				const costPrice = Number(item.data.prices?.costPrice) || 0;

				totalCost += (price * item.quantity);
				totalEarnings += ((price - costPrice) * item.quantity);

				return {
					product: item.data._id,
					variantSku: item.variantSku,
					variantLabel,
					quantity: item.quantity,
					price,
					productSnapshot: {
						brand: item.data.brand,
						model: item.data.model,
						image: item.data.images?.[0]?.url || ''
					}
				};
			});

			// 4. Validar pagos parciales
			const totalPaid = data.splitPayments.reduce((acc, p) => acc + p.amount, 0);
			if (totalPaid < totalCost) {
				throw new AppError('Monto insuficiente', `El pago total sumado ($${totalPaid}) no alcanza a cubrir el costo del pedido ($${totalCost})`, 400);
			}

			// 5. Descontar stock
			await ProductService.reduceVariantStock(models, variantItems);

			// 7. Crear el Order record
			const newOrder = await models.Order.create({
				user: data.userId, // Controller se encargará de proveer el genérico
				seller: data.sellerId,
				saleType: SaleType.LOCAL,
				status: OrderStatus.DELIVERED, // entregado automáticamente
				items: orderItems,
				shippingInfo: {
					type: ShippingType.PICKUP,
					cost: 0
				},
				paymentInfo: {
					method: data.splitPayments[0]?.method || PaymentType.CASH, // método primario
					amount: totalCost,
					status: PaymentStatus.APPROVED, // asumiendo que el mostrador cobra en el acto
					paymentDate: new Date()
				},
				splitPayments: data.splitPayments,
				total: totalCost,
				orderNumber: this.generateOrderNumber(),
				notes: data.notes,
				history: [{
					status: OrderStatus.DELIVERED,
					timestamp: new Date(),
					note: 'Venta presencial en local'
				}],
				earnings: totalEarnings
			});

			return await newOrder.populate([
				{ path: 'user', select: 'name email' },
				{ path: 'seller', select: 'name' },
				{ path: 'items.product', select: 'brand model prices images' }
			]);

		} catch (error) {
			console.error(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Error al procesar venta local', 'No se pudo generar la orden de mostrador.', 500);
		}
	}

	/**
	 * Estadísticas del día en la tienda física/online
	 */
	static async getDailyStats(models: TenantModels, dateParam?: string) {
		console.log('get daily stats');
		try {
			const targetDate = dateParam ? new Date(dateParam) : new Date();

			// Inicio del día en string param local u hora servidor (hoy)
			const startOfDay = new Date(targetDate);
			startOfDay.setHours(0, 0, 0, 0);

			const endOfDay = new Date(targetDate);
			endOfDay.setHours(23, 59, 59, 999);

			// Consultar todas las órdenes del día que no estén canceladas
			const dailyOrders = await models.Order.find({
				createdAt: { $gte: startOfDay, $lte: endOfDay },
				status: { $ne: OrderStatus.CANCELLED }
			});

			if (dailyOrders.length <= 0) {
				return null
			}

			let totalRevenue = 0;
			let totalEarnings = 0;
			const incomeByMethod: Record<string, number> = {};
			let localSalesCount = 0;
			let onlineSalesCount = 0;

			dailyOrders.forEach(order => {
				totalRevenue += order.total;
				// cast earnings manually to avoid sum TS error
				totalEarnings += Number(order.earnings) || 0;

				if (order.saleType === SaleType.LOCAL) localSalesCount++;
				else onlineSalesCount++;

				// Contabilizar splitPayments si los hay, sino fallback a paymentInfo primario
				if (order.splitPayments && order.splitPayments.length > 0) {
					order.splitPayments.forEach(sp => {
						incomeByMethod[sp.method] = (incomeByMethod[sp.method] || 0) + sp.amount;
					});
				} else {
					const method = order.paymentInfo?.method || 'unknown';
					incomeByMethod[method] = (incomeByMethod[method] || 0) + order.total;
				}
			});



			return {
				date: targetDate,
				totalRevenue,
				totalEarnings,
				salesCount: {
					total: dailyOrders.length,
					local: localSalesCount,
					online: onlineSalesCount
				},
				revenueByMethod: incomeByMethod
			};

		} catch (error) {
			console.log(error);
			throw new AppError('Failed to get daily stats', 'Error al obtener las estadísticas del día', 500);
		}
	}
}
