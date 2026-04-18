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
	ISplitPayment,
	IOrder,
	IProductSnapshot
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
import { PaymentElement } from '@/interfaces/mp_payment.interface';
import { ResendService } from './resend.service';
import { IVariant } from '@/interfaces/variant.interface';


// Campos sensibles de precios en el snapshot de la orden — solo visibles para admins
// Espejo de select:false declarado en orderItem.schema.ts
export const ADMIN_PRICE_SELECT = [
	'+items.productSnapshot.providerSnapshot',
	'+items.productSnapshot.prices.costPrice.inUSD',
	'+items.productSnapshot.prices.costPrice.inARS',
	'+items.productSnapshot.prices.dolarPrice',
	'+items.productSnapshot.prices.profitMargin',
	'+items.productSnapshot.prices.baseCommission',
	'+items.productSnapshot.prices.cft6Cuotas',
	'+items.productSnapshot.prices.earnings.cash_transfer',
	'+items.productSnapshot.prices.earnings.card_3_installments',
	'+items.productSnapshot.prices.earnings.card_6_installments',
	'+items.productSnapshot.prices.earnings.ticket'
].join(' ');

export class OrderService {
	private static generateOrderNumber(): string {
		const shortId = Math.random().toString(36).substring(2, 10).toUpperCase();
		return `REV-${shortId}`;
	}

	static async getOrderById(models: TenantModels, id: string): Promise<IOrderDocument> {
		try {
			if (!id) throw new AppError('Order ID is required', 'El ID de la orden es requerido', 400);
			const order = await models.Order.findById(id) as IOrderDocument;
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
			const order = await models.Order.findOne(query)
				.select(ADMIN_PRICE_SELECT)
				.populate([
					{ path: 'user', select: 'name email profilePhoto role' },
					{ path: 'items.productSnapshot.providerSnapshot', strictPopulate: false }
				]) as IOrderDocument;

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			return order;
		} catch (error) {
			console.log(error);
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
				.select(ADMIN_PRICE_SELECT)
				.populate('user', 'name email') as IOrderDocument;
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

	static async createOrder(models: TenantModels, data: CreateOrderDTO, userId: string | undefined, tenantSlug: string, baseUrl: string): Promise<CreateOrderResponse> {
		try {
			if (!data || data.items.length === 0)
				throw new AppError(
					'Order items are required',
					'Los items de la orden son requeridos',
					401
				);

			const user = await models.User.findById(userId)
			if (!user) {
				console.log('Es una compra guest');
			}

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

			const processItems = data.items.map(item => ({
				_id: item._id,
				sku: item.sku || '',
				quantity: item.quantity
			}));
			const processedOrderItems = await ProductService.processOrderItems(models, processItems);

			let installments: number | undefined = undefined;
			if (paymentMethod.type === PaymentType.CARD && data.mercadopagoData?.installments) {
				installments = data.mercadopagoData.installments;
				console.log('Se seleccino tarjeta y 1 pago');
			}

			/* creating payment service instance */
			const paymentService = new PaymentService(
				processedOrderItems.map(item => ({ data: item.data, quantity: item.quantity })),
				paymentMethod.type,
				shippingMethod.cost,
				installments
			);

			const finalCost = paymentService.getFinalCost();

			const status = OrderStatus.PENDING_PAYMENT;

			const orderItems = processedOrderItems.map((item) => {
				let unitPrice = item.data.prices.efectivo_transferencia;
				switch (paymentMethod.type) {
					case PaymentType.CARD:
						if (installments !== undefined && installments === 1) {
							console.log(`installments existe, y su valor es: ${installments}`);
							unitPrice = item.data.prices.efectivo_transferencia;
						} else {
							console.log(`installments existe, y su valor es: ${installments}`);
							unitPrice = item.data.prices.tarjeta_credito_debito;
						}
						break;
					case PaymentType.TICKET:
						unitPrice = item.data.prices.tarjeta_credito_debito;
						break;
					case PaymentType.CASH:
						unitPrice = item.data.prices.efectivo_transferencia;
						break;
					case PaymentType.BANK_TRANSFER:
						unitPrice = item.data.prices.efectivo_transferencia;
						break;
					case PaymentType.ALIAS_TRANSFER:
						unitPrice = item.data.prices.efectivo_transferencia;
						break;
					default:
						unitPrice = item.data.prices.efectivo_transferencia;
						break;
				}
				return {
					productSnapshot: item.productSnapshot as IProductSnapshot,
					variantSnapshot: item.variantSnapshot as IVariant,
					quantity: item.quantity as number,
					price: unitPrice as number
				};
			});

			/* creating order in DB */
			const newOrder = await (await models.Order.create(
				{
					user: userId,
					status,
					items: orderItems,
					shippingInfo: {
						type: shippingMethod.type,
						pickupPoint: data.shippingMethod.pickupPoint,
						cost: shippingMethod.cost
					},
					paymentInfo: {
						method: paymentMethod.type,
						amount: finalCost
					},
					buyerData: user ? {
						firstName: user.name.split(' ')[0],
						lastName: user.name.split(' ')[1],
						email: user.email,
						identificationType: '',
						identificationNumber: ''
					} : data.formPayerData,
					total: finalCost,
					orderNumber: this.generateOrderNumber(),
					history: [{
						status: status,
						timestamp: new Date(),
						note: 'Orden creada con éxito'
					}],
					earnings: PaymentService.theOrderIsPreferredPayment(paymentMethod.type)
						? paymentService.getEarnings()
						: 0
				}
			))
				.populate([
					{ path: 'user', select: 'name email' },
					{ path: 'items.productSnapshot.providerSnapshot' }
				])

			let extras: CreateOrderExtras | undefined;
			/* Try pay order */
			if (paymentMethod.type === PaymentType.CARD || paymentMethod.type === PaymentType.TICKET) {
				console.log('Payment method: ', paymentMethod.type);
				const config = await EcommerceService.getConfig(models);


				// Prioridad a MercadoPago si está activo y tenemos los datos necesarios
				if (config.paymentGateways.mercadopago.active && data.mercadopagoData) {
					const { result, error } = await paymentService.withMercadoPago({
						orderID: newOrder.id,
						models,
						total: finalCost,
						payerData: {
							email: user ? user.email : data.formPayerData.email,
							first_name: user ? user.name.split(' ')[0] : data.formPayerData.firstName,
							last_name: user ? user.name.split(' ').slice(1).join(' ') : data.formPayerData.lastName,
							identification: data.mercadopagoData.identification
						},
						mercadoPagoData: data.mercadopagoData,
						tenantSlug,
						baseUrl,
						items: orderItems.map((item) => ({
							title: `${item.productSnapshot.brand} ${item.productSnapshot.model}`,
							quantity: item.quantity,
							unit_price: item.price.toString(),
							picture_url: item.variantSnapshot.imageReference?.url || ''
						}))
					});

					if (error || !result) {
						throw new AppError('Failed to process MercadoPago payment', error || 'Error al procesar el pago de MercadoPago', 500);
					}

					newOrder.paymentInfo.transactionId = String(result.id);
					newOrder.paymentInfo.mercadopagoData = {
						items: result.items!,
						status: result.status!,
						status_detail: result.status_detail!,
						total_amount: result.total_amount!,
						total_paid_amount: result.total_paid_amount!,
						transactions: result.transactions!
					};

					// Si el pago es exitoso
					if (result.status === 'processed' || result.status === 'approved') {
						newOrder.paymentInfo.status = PaymentStatus.APPROVED;
						newOrder.status = OrderStatus.PROCESSING_SHIPPING;
						newOrder.paymentInfo.paymentDate = new Date();
						newOrder.history.push({
							status: OrderStatus.PROCESSING_SHIPPING,
							timestamp: new Date(),
							note: 'Pago acreditado automáticamente'
						});

						// Cálculo de ganancias preliminar
						const mpConfig = config.paymentGateways.mercadopago;
						const installments = data.mercadopagoData.installments || 1;
						const totalWithTaxes = finalCost / 1.21;
						const commission = mpConfig.baseCommission;
						// Para tickets (installments suele ser 1 o undefined), usamos la tasa base.
						const cft = (paymentMethod.type === PaymentType.TICKET) ? 0 : (installments <= 3 ? mpConfig.cft3cuotas : mpConfig.cft6Cuotas);
						const totalCost = totalWithTaxes * (1 - (commission + cft / 100));
						newOrder.earnings = finalCost - totalCost;
					}

					extras = {
						id: result.id,
						status: result.status,
						status_detail: result.status_detail,
						provider: EcommercePaymentProviders.MERCADOPAGO,
						ticket_url: result.status === 'action_required' ? result.transactions?.payments?.[0]?.payment_method?.ticket_url : undefined,
						qr: result.status === 'action_required' ? result.transactions?.payments?.[0]?.payment_method?.qr_code : undefined
					};
				}
				// Guardar el transactionId en la orden
				await newOrder.save();
			} else {
				console.log('Manual payment');
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

			/* Sending email confirmation */

			// if (paymentMethod.type === PaymentType.ALIAS_TRANSFER || paymentMethod.type === PaymentType.BANK_TRANSFER) {
			// 	await ResendService.sendTransferEmail(newOrder.toObject() as unknown as IOrder, models);
			// }
			// if (paymentMethod.type === PaymentType.CARD || paymentMethod.type === PaymentType.TICKET) {
			// 	await ResendService.sendOrderConfirmationEmail(newOrder.toObject() as unknown as IOrder);
			// }
			// if (paymentMethod.type === PaymentType.CASH) {
			// 	await ResendService.sendCashPaymentEmail(newOrder.toObject() as unknown as IOrder);
			// }

			const safeOrder = {
				...newOrder.toObject(),
				items: newOrder.toObject().items.map((item) =>
				({
					...item,
					productSnapshot: {
						...item.productSnapshot,
						providerSnapshot: null,
						prices: {
							efectivo_transferencia: item.productSnapshot.prices.efectivo_transferencia,
							tarjeta_credito_debito: item.productSnapshot.prices.tarjeta_credito_debito,
							cuotas: {
								cuotas_3_si: item.productSnapshot.prices.cuotas.cuotas_3_si,
								cuotas_6_si: item.productSnapshot.prices.cuotas.cuotas_6_si
							}
						}
					}
				}))
			} as unknown as IOrder;

			return { order: newOrder, safeOrder: safeOrder!, extras };
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
			order.paymentInfo.status = data.status;
			order.status = data.status === PaymentStatus.APPROVED ? OrderStatus.PROCESSING_SHIPPING : OrderStatus.PENDING_PAYMENT;
			const orderUpdated = await order.save();

			if (data.status === PaymentStatus.APPROVED) {
				await ResendService.sendPaymentReceivedEmail(orderUpdated.toObject() as unknown as IOrder);
			}

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

			if (oldStatus !== order.status) {
				if (order.status === OrderStatus.SHIPPED) {
					await ResendService.sendOrderShippedEmail(orderUpdated.toObject() as unknown as IOrder);
				} else if (order.status === OrderStatus.DELIVERED) {
					await ResendService.sendOrderDeliveredEmail(orderUpdated.toObject() as unknown as IOrder);
				}
			}

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
				.select(ADMIN_PRICE_SELECT)
				.populate([
					{ path: 'user', select: 'name email' },
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
							data: item.productSnapshot as any,
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

	static async confirmMercadoPagoPayment(models: TenantModels, orderId: string, payment: PaymentElement) {
		try {
			const config = await EcommerceService.getConfig(models);
			const mpConfig = config.paymentGateways.mercadopago;

			// const mpPayment = await MercadoPagoService.getPaymentStatus(mpConfig.accessToken, paymentId);
			const order = await models.Order.findById(orderId)
				.select(ADMIN_PRICE_SELECT)
				.populate([
					{ path: 'user', select: 'name email' },
				]) as IOrderDocument;

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			// Actualizar estado del pago
			order.paymentInfo.status = payment.status_detail === 'accredited'
				? PaymentStatus.APPROVED
				: PaymentStatus.REJECTED;

			if (order.paymentInfo.status === PaymentStatus.APPROVED) {
				order.paymentInfo.paymentDate = new Date();
				order.paymentInfo.transactionId = payment.id; // Guardamos el ID del pago real
				order.paymentInfo.mercadopagoData?.transactions?.payments?.push(payment); // Guardamos la info del pago

				// Calcular ganancias dinámicas basadas en cuotas si MP nos da el dato
				// Para tickets, installments suele ser 0 o 1, PaymentService.getEarnings(0) usará la ganancia de ticket
				const installments = payment.payment_method.installments;

				const itemsForPaymentService = order.items.map(item => ({
					data: item.productSnapshot as any,
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
				.select(ADMIN_PRICE_SELECT)
				.populate('user', 'name email profilePhoto role')
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
			if (order.user?.toString() !== userID && role !== 'admin') {
				throw new AppError(
					'You can only cancel your own orders',
					'Solo puedes cancelar tus propias órdenes',
					403
				);
			}

			if (order.status !== OrderStatus.PENDING_PAYMENT) {
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
					product: item.productSnapshot._id,
					variantSku: item.variantSnapshot.sku,
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
				const variant = item.data.variants?.find((v: any) => v.sku === item.variantSku) as any;

				// precio base (efectivo/transferencia es lo más común para mostrador)
				const price = item.data.prices?.efectivo_transferencia || 0;
				// costo del producto para calcular la ganancia
				const costPrice = Number(item.data.prices?.costPrice) || 0;

				totalCost += (price * item.quantity);
				totalEarnings += ((price - costPrice) * item.quantity);

				return {
					productSnapshot: {
						_id: item.data._id,
						brand: item.data.brand,
						model: item.data.model,
						image: item.data.images?.[0]?.url || '',
						slug: item.data.slug || '',
						// Snapshot de precios — necesario para cálculo de ganancias post-pago
						prices: {
							efectivo_transferencia: item.data.prices?.efectivo_transferencia,
							tarjeta_credito_debito: item.data.prices?.tarjeta_credito_debito,
							earnings: item.data.prices?.earnings
						}
					},
					variantSnapshot: {
						sku: variant?.sku || item.variantSku,
						size: variant?.size,
						attributes: variant?.attributes,
						color: variant?.color
					},
					quantity: item.quantity,
					price,
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

			// Reload the order from the database to enforce the select: false schema rules
			const safeOrder = await models.Order.findById(newOrder._id).populate([
				{ path: 'user', select: 'name email' },
				{ path: 'seller', select: 'name' },
			]);

			return safeOrder || newOrder;

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

	static async trackOrder(models: TenantModels, orderNumber: string, email: string) {
		try {
			const order = await models.Order.findOne({ orderNumber })
				.populate([
					{ path: 'user', select: 'email' },
				])
				.lean();

			if (!order) {
				throw new AppError('Order not found or incorrect data', 'Orden no encontrada o datos incorrectos', 404);
			}

			const queryEmail = email.toLowerCase().trim();
			const buyerEmail = order.buyerData?.email?.toLowerCase().trim();
			const userEmail = (order.user as any)?.email?.toLowerCase().trim();

			if (buyerEmail !== queryEmail && userEmail !== queryEmail) {
				throw new AppError('Order not found or incorrect data', 'Orden no encontrada o datos incorrectos', 404);
			}

			return order;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to track order',
				'Error al rastrear la orden',
				500
			);
		}
	}
}
