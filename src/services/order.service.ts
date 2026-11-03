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
import { ImageService } from './images.service';
import { CouponService } from './coupon.service';
import { OrderPaymentService } from './order/orderPayment.service';
import { OrderStatsService } from './order/orderStats.service';

import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { UalaOrderStatus } from '@/interfaces/ualaWebhook.interface';
import { Role } from '@/interfaces/user.interface';
import { FilterQuery } from 'mongoose';
import { TenantModels } from '@/config/modelRegistry';
import { PaymentElement } from '@/interfaces/mp_payment.interface';
import { ResendService } from './resend.service';
import { IVariant } from '@/interfaces/variant.interface';
import { MetaService } from './meta.service';
import { isEligibleForFreeShipping, calculateDynamicShippingCost, detectShippingZone } from '@/utils/provinces';
import { getDolar } from './dolar.service';


// Campos sensibles de precios en el snapshot de la orden — solo visibles para admins
// Espejo de select:false declarado en orderItem.schema.ts
export const ADMIN_PRICE_SELECT = '+finance.baseCost +finance.earnings +finance.earningsOppositeCurrency +items.productSnapshot.providerSnapshot +items.productSnapshot.finance';

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

	static async createOrder(
		models: TenantModels,
		data: CreateOrderDTO,
		userId: string | undefined,
		tenantSlug: string,
		baseUrl: string,
		metaTracking?: {
			fbc?: string;
			fbp?: string;
			clientIp?: string;
			clientUserAgent?: string;
			externalId?: string;
			eventSourceUrl?: string;
		}
	): Promise<CreateOrderResponse> {
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

			// Validar límite de órdenes pendientes para pagos manuales (transferencia/efectivo)
			const isManualPayment = paymentMethod.type === PaymentType.BANK_TRANSFER || 
			                        paymentMethod.type === PaymentType.ALIAS_TRANSFER || 
			                        paymentMethod.type === PaymentType.CASH;

			if (isManualPayment) {
				const userEmail = user?.email || data.formPayerData?.email;
				const pendingFilter: any[] = [];
				if (userId) pendingFilter.push({ user: userId });
				if (userEmail) pendingFilter.push({ 'buyerData.email': userEmail.toLowerCase() });

				if (pendingFilter.length > 0) {
					const existingPendingOrder = await models.Order.findOne({
						$or: pendingFilter,
						status: OrderStatus.PENDING_PAYMENT,
						'paymentInfo.status': { $in: [PaymentStatus.PENDING, PaymentStatus.WAITING_CONFIRMATION] }
					}).select('orderNumber createdAt total');

					if (existingPendingOrder) {
						throw new AppError(
							'Pending order limit reached',
							`Ya tenés una orden pendiente de pago (Orden N° ${existingPendingOrder.orderNumber}). Por favor realizá el pago o esperá su confirmación antes de generar un nuevo pedido.`,
							400
						);
					}
				}
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
			}

			/* calculate dynamic shipping logic */
			const config = await EcommerceService.getConfig(models);
			const threshold = config.shippingConfig?.freeShippingThreshold ?? 80000;
			const subtotalBase = processedOrderItems.reduce((acc, item) => {
				let unitPrice = item.data.price?.cashTransferPrice || 0;
				switch (paymentMethod.type) {
					case PaymentType.CARD:
						if (installments !== undefined && installments === 1) {
							unitPrice = item.data.price?.card_ticket1PayPrice || item.data.price?.listPrice || 0;
						} else {
							unitPrice = item.data.price?.listPrice || 0;
						}
						break;
					case PaymentType.TICKET:
						unitPrice = item.data.price?.card_ticket1PayPrice || item.data.price?.listPrice || 0;
						break;
					case PaymentType.CASH:
					case PaymentType.BANK_TRANSFER:
					case PaymentType.ALIAS_TRANSFER:
					default:
						unitPrice = item.data.price?.cashTransferPrice || 0;
						break;
				}
				return acc + (unitPrice * item.quantity);
			}, 0);
			const totalItems = processedOrderItems.reduce((acc, item) => acc + item.quantity, 0);

			// Aplicar descuento por cupón o primera compra automática sobre la mercancía
			let couponDiscountAmount = 0;
			let appliedCouponCode: string | undefined = undefined;
			const couponToValidate = data.couponCode || 'PRIMERACOMPRA';
			const payerEmail = user?.email || data.formPayerData?.email;


			const couponResult = await CouponService.validateCoupon(models, {
				code: couponToValidate,
				subtotal: subtotalBase,
				email: payerEmail,
				userId
			});

			if (couponResult.isValid && couponResult.discountAmount > 0) {
				couponDiscountAmount = couponResult.discountAmount;
				appliedCouponCode = couponResult.code;
			}

			// Subtotal neto tras descuento de cupón para evaluar el umbral de envío gratis
			const netMerchandiseTotal = Math.max(0, subtotalBase - couponDiscountAmount);

			let appliedShippingCost = shippingMethod.cost;

			if (shippingMethod.type === ShippingType.HOME_DELIVERY) {
				const state = data.shippingMethod.address?.state || '';
				const zipCode = data.shippingMethod.address?.zipCode;
				const accumulatedSubsidy = processedOrderItems.reduce((acc, item) => {
					const itemSubsidy = (item.data.price as any)?.shippingSubsidy ?? config.shippingConfig?.defaultItemSubsidy ?? 4000;
					return acc + (itemSubsidy * item.quantity);
				}, 0);

				const calc = calculateDynamicShippingCost({
					subtotal: netMerchandiseTotal,
					itemCount: totalItems,
					accumulatedSubsidy,
					stateOrProvince: state,
					zipCode,
					shippingConfig: config.shippingConfig
				});

				const isExpress = (data.shippingMethod as any)?.service === 'express' ||
					(shippingMethod.name && shippingMethod.name.toLowerCase().includes('expres'));
				if (isExpress) {
					const expressOpt = calc.options.find(o => o.service === 'express');
					appliedShippingCost = expressOpt ? expressOpt.cost : calc.finalShippingCost;
				} else {
					appliedShippingCost = calc.finalShippingCost;
				}
			} else if (shippingMethod.type === ShippingType.PICKUP || shippingMethod.type === ShippingType.STORE_PICKUP) {
				appliedShippingCost = 0;
			} else if (shippingMethod.type === ShippingType.BRANCH_PICKUP) {
				if (netMerchandiseTotal >= threshold) {
					appliedShippingCost = 0;
				} else {
					appliedShippingCost = shippingMethod.cost || (config.shippingConfig?.minShippingFloor ?? 5000);
				}
			}

			/* creating payment service instance */
			const paymentService = new PaymentService(
				processedOrderItems.map(item => ({ data: item.data, quantity: item.quantity })),
				paymentMethod.type,
				appliedShippingCost,
				installments
			);

			const finalCost = paymentService.getFinalCost();

			const status = OrderStatus.PENDING_PAYMENT;

			const orderItems = processedOrderItems.map((item) => {
				let unitPrice = item.data.price?.cashTransferPrice || 0;
				switch (paymentMethod.type) {
					case PaymentType.CARD:
						if (installments !== undefined && installments === 1) {
							unitPrice = item.data.price?.card_ticket1PayPrice || 0;
						} else {
							unitPrice = item.data.price?.listPrice || 0;
						}
						break;
					case PaymentType.TICKET:
						unitPrice = item.data.price?.card_ticket1PayPrice || 0;
						break;
					case PaymentType.CASH:
					case PaymentType.BANK_TRANSFER:
					case PaymentType.ALIAS_TRANSFER:
					default:
						unitPrice = item.data.price?.cashTransferPrice || 0;
						break;
				}
				return {
					productSnapshot: item.productSnapshot as IProductSnapshot,
					variantSnapshot: item.variantSnapshot as IVariant,
					quantity: item.quantity as number,
					price: unitPrice as number,
					costPriceSnapshot: {
						inUSD: item.data.finance?.providerCost?.inUSD || 0,
						inARS: item.data.finance?.providerCost?.inARS || 0
					}
				};
			});

			const { venta: dolarVenta } = await getDolar(config.dollarQuoteType || 'oficial', config.customDollarRate || 0);
			const isARS = config.costCurrency === 'ARS';

			// Total a pagar restando el descuento de cupón previamente calculado sobre la mercancía
			const payableTotal = Math.max(0, finalCost - couponDiscountAmount);

			const baseCost = orderItems.reduce((acc, item) => acc + (isARS ? item.costPriceSnapshot.inARS : item.costPriceSnapshot.inUSD) * item.quantity, 0);

			const totalOppositeCurrency = isARS ? payableTotal / dolarVenta : payableTotal * dolarVenta;
			const earningsVal = PaymentService.theOrderIsPreferredPayment(paymentMethod.type)
				? paymentService.getEarnings()
				: 0;
			const earningsOppositeCurrency = isARS ? earningsVal / dolarVenta : earningsVal * dolarVenta;

			/* creating order in DB — SIN intentar cobro */
			const newOrder = await (await models.Order.create(
				{
					user: userId,
					status,
					items: orderItems,
					shippingInfo: {
						type: shippingMethod.type,
						carrier: (shippingMethod as any).carrier || (shippingMethod as any).name || undefined,
						pickupPoint: data.shippingMethod.pickupPoint,
						shippingAddress: data.shippingMethod.address,
						cost: appliedShippingCost,
						freeShippingApplied: appliedShippingCost === 0 && shippingMethod.type !== ShippingType.PICKUP && shippingMethod.type !== ShippingType.STORE_PICKUP
					},
					paymentInfo: {
						method: paymentMethod.type,
						amount: payableTotal
					},
					buyerData: (user && !(data.isThirdPartyPayer && data.formPayerData)) ? {
						firstName: user.name.split(' ')[0],
						lastName: user.name.split(' ')[1] || '',
						email: user.email,
						identificationType: data.formPayerData?.identificationType || '',
						identificationNumber: data.formPayerData?.identificationNumber || ''
					} : data.formPayerData,
					finance: {
						total: payableTotal,
						baseCost,
						earnings: earningsVal,
						totalOppositeCurrency,
						earningsOppositeCurrency,
						exchangeRateSnapshot: dolarVenta,
						installments: installments || 1,
						couponCode: appliedCouponCode,
						couponDiscount: couponDiscountAmount
					},
					orderNumber: this.generateOrderNumber(),
					isThirdPartyPayer: data.isThirdPartyPayer || false,
					metaTracking: metaTracking || data.metaTracking,
					history: [{
						status: status,
						timestamp: new Date(),
						note: 'Orden creada con éxito'
					}]
				}
			))
				.populate([
					{ path: 'user', select: 'name email' },
					{ path: 'items.productSnapshot.providerSnapshot' }
				])

			if (appliedCouponCode) {
				await CouponService.recordCouponUsage(models, appliedCouponCode, String(newOrder._id), payerEmail, userId);
			}

			// Para pagos manuales, no se necesita un paso separado de pago
			let extras: CreateOrderExtras | undefined;
			if (
				paymentMethod.type !== PaymentType.CARD &&
				paymentMethod.type !== PaymentType.TICKET
			) {
				console.log('Manual payment — orden creada sin gateway');
				extras = {
					provider: 'manual',
					name: paymentMethod.name || 'Manual',
					instructions: paymentMethod.description || 'Pendiente de confirmación manual',
					status: 'waiting_confirmation',
					alias: (paymentMethod as any).alias,
					cbuCvu: (paymentMethod as any).cbuCvu,
					bankName: (paymentMethod as any).bankName,
					titular: (paymentMethod as any).titular
				};
				newOrder.paymentInfo.status = PaymentStatus.PENDING;
				await newOrder.save();

				// Disparar envío de correo automático para transferencias bancarias o alias
				if (
					paymentMethod.type === PaymentType.BANK_TRANSFER ||
					paymentMethod.type === PaymentType.ALIAS_TRANSFER
				) {
					ResendService.sendTransferEmail({
						order: newOrder.toObject() as unknown as IOrder,
						isThirdParty: !!data.isThirdPartyPayer,
						models
					})
						.catch(err => console.error('Error enviando email de transferencia:', err));
				}
			}

			// Disparar evento InitiateCheckout a Meta Conversions API para cualquier orden creada
			MetaService.trackInitiateCheckoutFromOrder(
				newOrder.toObject(),
				metaTracking?.clientIp,
				metaTracking?.clientUserAgent,
				metaTracking?.eventSourceUrl,
				models
			).catch(err => console.error('[Meta CAPI] Error enviando InitiateCheckout:', err));

			const safeOrder = this.buildSafeOrder(newOrder);

			return { order: newOrder, safeOrder: safeOrder!, extras };
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create order', 'Error al intentar crear la orden', 500);
		}
	}

	/**
	 * Intenta cobrar una orden existente. Puede reintentarse N veces.
	 * Solo funciona para órdenes en status PENDING_PAYMENT o PAYMENT_FAILED.
	 * Si la orden ya está pagada → 409 Conflict.
	 */
	static async payOrder(
		models: TenantModels,
		orderId: string,
		mercadopagoData: CreateOrderDTO['mercadopagoData'],
		userId: string | undefined,
		tenantSlug: string,
		baseUrl: string
	): Promise<CreateOrderResponse> {
		try {
			const order = await models.Order.findById(orderId)
				.select(ADMIN_PRICE_SELECT)
				.populate([
					{ path: 'user', select: 'name email' },
					{ path: 'items.productSnapshot.providerSnapshot' }
				]) as IOrderDocument;

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			// Validar ownership: si la orden tiene usuario, debe coincidir
			if (order.user && userId && order.user._id.toString() !== userId.toString()) {
				throw new AppError(
					'You can only pay your own orders',
					'Solo podés pagar tus propias órdenes',
					403
				);
			}

			// Validar que la orden sea pagable
			if (order.status === OrderStatus.PROCESSING_SHIPPING ||
				order.status === OrderStatus.SHIPPED ||
				order.status === OrderStatus.DELIVERED) {
				throw new AppError(
					'Order is already paid',
					'Esta orden ya fue pagada',
					409
				);
			}

			if (order.status === OrderStatus.CANCELLED) {
				throw new AppError(
					'Order is cancelled',
					'Esta orden fue cancelada y no se puede pagar',
					400
				);
			}

			// Solo PENDING_PAYMENT y PAYMENT_FAILED pueden intentar pago
			if (order.status !== OrderStatus.PENDING_PAYMENT && order.status !== OrderStatus.PAYMENT_FAILED) {
				throw new AppError(
					'Order cannot be paid in current status',
					'La orden no puede ser pagada en su estado actual',
					400
				);
			}

			const paymentMethodType = order.paymentInfo.method;

			// Para pagos manuales, no necesitan pasar por acá
			if (
				paymentMethodType !== PaymentType.CARD &&
				paymentMethodType !== PaymentType.TICKET
			) {
				throw new AppError(
					'Manual payments do not require this endpoint',
					'Los pagos manuales no requieren este endpoint. La orden ya fue creada con éxito.',
					400
				);
			}

			// Verificar que tengamos datos de MP para cobrar
			if (!mercadopagoData) {
				throw new AppError(
					'MercadoPago data is required for card/ticket payments',
					'Se requieren datos de MercadoPago para pagos con tarjeta/ticket',
					400
				);
			}

			const config = await EcommerceService.getConfig(models);
			if (!config.paymentGateways.mercadopago.active) {
				throw new AppError(
					'MercadoPago is not configured',
					'MercadoPago no está configurado para esta tienda',
					400
				);
			}

			// Calcular installments para seleccionar precio correcto
			let installments: number | undefined = undefined;
			if (paymentMethodType === PaymentType.CARD && mercadopagoData.installments) {
				installments = mercadopagoData.installments;
			}

			// Construir PaymentService desde los datos ya guardados en la orden
			const itemsForPaymentService = order.items.map(item => ({
				data: item.productSnapshot as any,
				quantity: item.quantity
			}));

			const paymentService = new PaymentService(
				itemsForPaymentService,
				paymentMethodType,
				order.shippingInfo.cost,
				installments
			);

			const finalCost = order.finance.total; // Usamos el total ya calculado en createOrder

			// Armar datos del payer desde los datos ya guardados en la orden
			const buyerData = order.buyerData;
			const orderUser = order.user as any; // puede ser populated o null

			const payerEmail = orderUser?.email || buyerData?.email;
			const payerFirstName = orderUser?.name?.split(' ')[0] || buyerData?.firstName;
			const payerLastName = orderUser?.name?.split(' ').slice(1).join(' ') || buyerData?.lastName;

			// Calcular precios netos ajustados por descuento para MercadoPago
			const shippingCost = order.shippingInfo?.cost || 0;
			const targetItemsSubtotal = Math.max(0, finalCost - shippingCost);
			const rawItemsSubtotal = order.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

			let currentSum = 0;
			const mpItems = order.items.map((item, index) => {
				let discountedUnitPrice: number;
				if (rawItemsSubtotal > 0) {
					if (index === order.items.length - 1) {
						const remaining = targetItemsSubtotal - currentSum;
						discountedUnitPrice = Math.max(0, Math.round(remaining / item.quantity));
					} else {
						const ratio = (item.price * item.quantity) / rawItemsSubtotal;
						const itemTarget = targetItemsSubtotal * ratio;
						discountedUnitPrice = Math.max(0, Math.round(itemTarget / item.quantity));
						currentSum += discountedUnitPrice * item.quantity;
					}
				} else {
					discountedUnitPrice = item.price;
				}

				return {
					title: `${item.productSnapshot.brand} ${item.productSnapshot.model}`,
					quantity: item.quantity,
					unit_price: discountedUnitPrice.toString(),
					picture_url: item.variantSnapshot?.imageReference?.url || ''
				};
			});

			if (shippingCost > 0) {
				mpItems.push({
					title: 'Costo de Envío',
					quantity: 1,
					unit_price: shippingCost.toString(),
					picture_url: ''
				});
			}

			const { result, error } = await paymentService.withMercadoPago({
				orderID: order.id,
				models,
				total: finalCost,
				payerData: {
					email: payerEmail,
					first_name: payerFirstName,
					last_name: payerLastName,
					identification: mercadopagoData.identification
				},
				mercadoPagoData: mercadopagoData,
				tenantSlug,
				baseUrl,
				items: mpItems
			});

			let extras: CreateOrderExtras | undefined;

			if (error || !result) {
				// Pago falló → marcamos la orden como PAYMENT_FAILED (reintentable)
				order.status = OrderStatus.PAYMENT_FAILED;
				order.paymentInfo.status = PaymentStatus.REJECTED;
				order.history.push({
					status: OrderStatus.PAYMENT_FAILED,
					timestamp: new Date(),
					note: `Intento de pago fallido: ${error || 'Error desconocido'}`
				});
				await order.save();

				throw new AppError(
					'Payment failed',
					'No pudimos procesar el pago con tu tarjeta. Por favor chequeá que los datos estén bien escritos y que cuentes con saldo o límite disponible.',
					402
				);
			}

			// Map status/details
			let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
			let orderStatus: OrderStatus = OrderStatus.PENDING_PAYMENT;
			let note = '';

			const status = String(result.status || '').toLowerCase();
			const statusDetail = String(result.status_detail || '').toLowerCase();

			if (status === 'approved' || status === 'processed' || statusDetail === 'accredited') {
				const paidAmount = Number((result as any).transaction_amount || (result as any).amount || (result as any).total_amount || 0);
				const expectedTotal = Number(order.finance.total || 0);

				if (paidAmount > 0 && paidAmount < expectedTotal - 1) {
					console.error(`🚨 [Fraude Detectado MP] Monto pagado ($${paidAmount}) menor al total de la orden ($${expectedTotal}) en orden ${order.id}`);
					paymentStatus = PaymentStatus.REJECTED;
					orderStatus = OrderStatus.PAYMENT_FAILED;
					note = `Pago rechazado: Monto recibido ($${paidAmount}) no coincide con el total de la orden ($${expectedTotal})`;
				} else {
					paymentStatus = PaymentStatus.APPROVED;
					orderStatus = OrderStatus.PROCESSING_SHIPPING;
					note = 'Pago acreditado con éxito';
				}
			} else if (
				status === 'created' ||
				status === 'in_process' || 
				status === 'processing' || 
				status === 'in_review' || 
				status === 'pending' ||
				statusDetail === 'created' ||
				statusDetail === 'in_process' ||
				statusDetail === 'pending_review_manual' ||
				statusDetail === 'in_review' ||
				statusDetail === 'waiting_payment' ||
				statusDetail === 'waiting_capture' ||
				statusDetail === 'waiting_transfer' ||
				statusDetail === 'pending_challenge'
			) {
				paymentStatus = PaymentStatus.PENDING;
				orderStatus = OrderStatus.PENDING_PAYMENT;
				note = status === 'created' ? 'Orden Checkout Pro iniciada en Mercado Pago' : `Pago en proceso: ${result.status}`;
			} else if (
				status === 'rejected' ||
				status === 'cancelled' ||
				status === 'refunded' ||
				status === 'charged_back' ||
				status === 'failed' ||
				status === 'expired'
			) {
				paymentStatus = PaymentStatus.REJECTED;
				orderStatus = OrderStatus.PAYMENT_FAILED;
				note = `Pago no aprobado: ${result.status}`;
			} else {
				paymentStatus = PaymentStatus.PENDING;
				orderStatus = OrderStatus.PENDING_PAYMENT;
				note = `Estado de pago recibido: ${result.status}`;
			}

			if (status === 'cancelled' || status === 'expired' || statusDetail === 'expired' || statusDetail === 'cancelled') {
				paymentStatus = PaymentStatus.CANCELLED;
				orderStatus = OrderStatus.CANCELLED;
			}

			const oldPaymentStatus = order.paymentInfo.status;
			const isFirstPaymentUpdate = !order.paymentInfo.transactionId || order.paymentInfo.transactionId.startsWith('TX-');

			// Pago procesado por MP — actualizar la orden
			order.paymentInfo.status = paymentStatus;
			order.status = orderStatus;
			order.paymentInfo.transactionId = String(result.id);
			order.paymentInfo.mercadopagoData = {
				items: result.items || [],
				status: result.status || 'created',
				status_detail: result.status_detail || 'created',
				total_amount: result.total_amount ? String(result.total_amount) : String(order.finance.total),
				total_paid_amount: result.total_paid_amount ? String(result.total_paid_amount) : '0',
				transactions: result.transactions || {}
			};

			order.history.push({
				status: orderStatus,
				timestamp: new Date(),
				note,
				target: 'all'
			});

			if (paymentStatus === PaymentStatus.APPROVED) {
				order.paymentInfo.paymentDate = new Date();
				const mpInstallments = mercadopagoData.installments || 1;
				order.finance.installments = mpInstallments;

				// 1. Calcular comisión real de Mercado Pago con IVA
				const rawBaseComm = config.paymentGateways.mercadopago.baseCommission;
				const rawCFT3 = config.paymentGateways.mercadopago.cft3cuotas;
				const rawCFT6 = config.paymentGateways.mercadopago.cft6Cuotas;
				const ivaFactor = 1 + Number(config.taxes?.iva || 21) / 100;
				let tasa = Number(rawBaseComm) / 100;
				if (mpInstallments > 3) {
					tasa = (Number(rawBaseComm) + Number(rawCFT6)) / 100;
				} else if (mpInstallments > 1) {
					tasa = (Number(rawBaseComm) + Number(rawCFT3)) / 100;
				}
				order.finance.paymentGatewayFee = Math.round(order.finance.total * (tasa * ivaFactor));

				// 2. Calcular gastos operativos e impuestos totales de los productos
				let totalOperationalExpenses = 0;
				let totalTaxes = 0;

				for (const item of order.items) {
					const providerCost = item.productSnapshot?.finance?.providerCost?.inARS || 0;
					const additionalCosts = item.productSnapshot?.finance?.additionalCosts;
					if (!additionalCosts || !Array.isArray(additionalCosts)) continue;

					let itemOpExp = 0;
					let itemTax = 0;

					for (const c of additionalCosts) {
						const val = Number(c.value) || 0;
						const isTax = c.category === 'tax';

						if (c.type === 'percent_over_provider') {
							const cost = providerCost * (val / 100);
							if (isTax) itemTax += cost;
							else itemOpExp += cost;
						} else if (c.type === 'fixed') {
							if (isTax) itemTax += val;
							else itemOpExp += val;
						} else if (c.type === 'percent_over_price') {
							const itemPrice = item.price || 0;
							const taxOnPrice = itemPrice * (val / 100);
							itemTax += taxOnPrice;
						}
					}
					totalOperationalExpenses += (itemOpExp * item.quantity);
					totalTaxes += (itemTax * item.quantity);
				}

				order.finance.operationalExpenses = Math.round(totalOperationalExpenses);
				order.finance.taxes = Math.round(totalTaxes);

				// 3. Calcular Ganancia Neta Real (Total Abonado - Costo Base - Gastos Operativos - Impuestos - Comisión MP - Envío)
				const shippingCost = order.shippingInfo?.cost || 0;
				const realEarnings = Math.round(
					order.finance.total - order.finance.baseCost - totalOperationalExpenses - totalTaxes - order.finance.paymentGatewayFee - shippingCost
				);
				const earningsVal = Math.max(0, realEarnings);
				order.finance.earnings = earningsVal;

				const dolarVenta = order.finance.exchangeRateSnapshot || (await getDolar(config.dollarQuoteType || 'oficial', config.customDollarRate || 0)).venta;
				const isARS = config.costCurrency === 'ARS';
				order.finance.earningsOppositeCurrency = isARS ? earningsVal / dolarVenta : earningsVal * dolarVenta;
			}

			extras = {
				id: result.id,
				status: result.status,
				status_detail: result.status_detail,
				provider: EcommercePaymentProviders.MERCADOPAGO,
				ticket_url: result.status === 'action_required' ? result.transactions?.payments?.[0]?.payment_method?.ticket_url : undefined,
				qr: result.status === 'action_required' ? result.transactions?.payments?.[0]?.payment_method?.qr_code : undefined,
				checkout_url: (result as any).checkout_available_at || (result as any).checkout_url || (result as any).init_point || undefined
			};

			await order.save();

			// Trigger emails & Meta CAPI Purchase
			if (order.paymentInfo.status === PaymentStatus.APPROVED && oldPaymentStatus !== PaymentStatus.APPROVED) {
				await ResendService.sendOrderConfirmationEmail(order.toObject() as unknown as IOrder, models);
				MetaService.trackPurchaseFromOrder(order.toObject(), undefined, undefined, undefined, models)
					.catch(err => console.error('[Meta CAPI] Error enviando Purchase event:', err));
				this.recordOrderRankingSales(models, order.toObject())
					.catch(err => console.error('[Ranking] Error tracking sale:', err));
			} else if (order.paymentInfo.status === PaymentStatus.PENDING && isFirstPaymentUpdate) {
				await ResendService.sendPaymentInProcessEmail(order.toObject() as unknown as IOrder, models);
			}

			const safeOrder = this.buildSafeOrder(order);

			return { order, safeOrder: safeOrder!, extras };
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to process payment', 'Error al intentar procesar el pago', 500);
		}
	}

	/**
	 * Helper: suma ventas a las métricas del producto para el cálculo del score ELO
	 */
	private static recordOrderRankingSales = OrderPaymentService.recordOrderRankingSales;

	/**
	 * Helper: construye un objeto de orden sin datos sensibles para enviar al frontend.
	 */
	private static buildSafeOrder(order: IOrderDocument): IOrder {
		const orderObj = order.toObject();
		return {
			...orderObj,
			finance: orderObj.finance ? {
				total: orderObj.finance.total,
				totalOppositeCurrency: orderObj.finance.totalOppositeCurrency,
				exchangeRateSnapshot: orderObj.finance.exchangeRateSnapshot,
				installments: orderObj.finance.installments,
				paymentGatewayFee: orderObj.finance.paymentGatewayFee,
				couponCode: orderObj.finance.couponCode,
				couponDiscount: orderObj.finance.couponDiscount,
				// Omit sensitive data
				baseCost: 0,
				earnings: 0,
				earningsOppositeCurrency: 0
			} : undefined,
			items: orderObj.items.map((item: any) =>
			({
				...item,
				costPriceSnapshot: undefined,
				productSnapshot: {
					...item.productSnapshot,
					providerSnapshot: undefined,
					finance: undefined,
					price: item.productSnapshot.price
				}
			}))
		} as unknown as IOrder;
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
			let note = `Pago actualizado a ${data.status}`;
			if (data.status === PaymentStatus.APPROVED) {
				note = 'Pago recibido';
			} else if (data.status === PaymentStatus.REJECTED) {
				note = 'Pago rechazado';
			}

			order.history.push({
				status: order.status,
				timestamp: new Date(),
				note: note
			});

			const orderUpdated = await order.save();

			if (data.status === PaymentStatus.APPROVED) {
				await ResendService.sendPaymentReceivedEmail(orderUpdated.toObject() as unknown as IOrder, models);
				MetaService.trackPurchaseFromOrder(orderUpdated.toObject(), undefined, undefined, undefined, models)
					.catch(err => console.error('[Meta CAPI] Error enviando Purchase event:', err));
				this.recordOrderRankingSales(models, orderUpdated.toObject())
					.catch(err => console.error('[Ranking] Error tracking sale:', err));
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

			if (data.trackingNumber !== undefined) {
				order.shippingInfo.trackingNumber = data.trackingNumber.trim();
			}
			if (data.carrier !== undefined && data.carrier.trim()) {
				order.shippingInfo.carrier = data.carrier.trim();
			}

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

			order.markModified('shippingInfo');
			const orderUpdated = await order.save();

			if (oldStatus !== order.status) {
				if (order.status === OrderStatus.SHIPPED) {
					await ResendService.sendOrderShippedEmail(orderUpdated.toObject() as unknown as IOrder, models);
				} else if (order.status === OrderStatus.DELIVERED) {
					await ResendService.sendOrderDeliveredEmail(orderUpdated.toObject() as unknown as IOrder, models);
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

	static confirmCardPayment = OrderPaymentService.confirmCardPayment;

	static confirmMercadoPagoPayment = OrderPaymentService.confirmMercadoPagoPayment;
	static confirmGetnetPayment = OrderPaymentService.confirmGetnetPayment;

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

		try {
			const order = await this.getOrderById(models, id);
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			const isAdmin = role === Role.admin || (role as string) === 'admin';
			const orderUserId = order.user ? (order.user._id ? order.user._id.toString() : order.user.toString()) : null;

			// Verificar propiedad de la orden para usuarios no administradores
			if (!isAdmin && orderUserId !== userID.toString()) {
				throw new AppError(
					'You can only cancel your own orders',
					'Solo puedes cancelar tus propias órdenes',
					403
				);
			}

			// Ya está cancelada
			if (order.status === OrderStatus.CANCELLED) {
				throw new AppError(
					'Order is already cancelled',
					'Esta orden ya fue cancelada previamente',
					400
				);
			}

			// Para clientes comunes, solo se permite cancelar órdenes pendientes de pago o fallidas
			if (!isAdmin) {
				const cancellableStatuses: OrderStatus[] = [
					OrderStatus.PENDING_PAYMENT,
					OrderStatus.PAYMENT_FAILED
				];
				if (!cancellableStatuses.includes(order.status)) {
					throw new AppError(
						'Paid or processing orders cannot be cancelled directly',
						'Esta orden ya fue pagada o está en proceso. Para cancelarla, por favor ponete en contacto con nosotros vía WhatsApp.',
						400
					);
				}
			}

			order.status = OrderStatus.CANCELLED;
			order.history.push({
				status: OrderStatus.CANCELLED,
				timestamp: new Date()
			});

			order.paymentInfo.status = PaymentStatus.CANCELLED;
			await order.save();

			// 1. Restaurar stock de las variantes
			if (order.items && order.items.length > 0) {
				await ProductService.restoreVariantStock(models,
					order.items.map((item: any) => ({
						product: item.productSnapshot._id,
						variantSku: item.variantSnapshot.sku,
						quantity: item.quantity
					}))
				);
			}

			// 2. Restaurar cupón o beneficio/reward consumido si aplica
			if (order.finance?.couponCode) {
				const targetEmail = order.buyerData?.email;
				await CouponService.restoreCouponUsage(models, order.finance.couponCode, String(order._id), targetEmail, userID);
			}

			const updatedOrder = await this.getOrderByIdFullyPopulated(models, id);
			return updatedOrder;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('failed to cancel order', 'Error al intentar cancelar la orden', 500);
		}
	}

	static getOrderStats = OrderStatsService.getOrderStats;

	// ==========================================
	// Métodos para POS / Ventas Locales
	// ==========================================

	/**
	 * Crea un pedido de venta local (mostrador). Se descuenta stock inmediatamente.
	 * Soporta pagos en efectivo, QR Mercado Pago, tarjetas y transferencia bancaria con comprobante.
	 */
	static async createLocalOrder(
		models: TenantModels,
		data: {
			items: { _id: string; sku?: string; quantity: number }[];
			splitPayments: ISplitPayment[];
			sellerId: string;
			userId?: string;
			notes?: string;
			paymentReceipt?: {
				url: string;
				public_id?: string;
			};
		}
	) {
		try {
			const config = await EcommerceService.getConfig(models);
			const isARS = config.costCurrency === 'ARS';

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
				const price = item.data.price?.cashTransferPrice || 0;
				// costo del producto para calcular la ganancia
				const costPrice = isARS 
					? (item.data.finance?.providerCost?.inARS || 0) 
					: (item.data.finance?.providerCost?.inUSD || 0);

				totalCost += Math.round(price * item.quantity);
				totalEarnings += Math.round((price - costPrice) * item.quantity);

				return {
					productSnapshot: {
						_id: item.data._id,
						brand: item.data.brand,
						model: item.data.model,
						image: item.data.images?.[0]?.url || '',
						slug: item.data.slug || '',
						isSoldByWeight: Boolean((item.data as any).isSoldByWeight),
						unit: (item.data as any).unit || 'Unidad',
						price: item.data.price
					},
					variantSnapshot: {
						sku: variant?.sku || item.variantSku || 'DEFAULT',
						size: variant?.size,
						attributes: variant?.attributes,
						color: variant?.color
					},
					quantity: item.quantity,
					price,
					costPriceSnapshot: {
						inUSD: item.data.finance?.providerCost?.inUSD || 0,
						inARS: item.data.finance?.providerCost?.inARS || 0
					}
				};
			});

			// 4. Validar pagos parciales
			const totalPaid = data.splitPayments.reduce((acc, p) => acc + p.amount, 0);
			if (totalPaid < totalCost && (totalCost - totalPaid) > 1) {
				throw new AppError('Monto insuficiente', `El pago total sumado ($${totalPaid}) no alcanza a cubrir el costo del pedido ($${totalCost})`, 400);
			}

			// 5. Descontar stock
			await ProductService.reduceVariantStock(models, variantItems);

			const { venta: dolarVenta } = await getDolar(config.dollarQuoteType || 'oficial', config.customDollarRate || 0);
			const totalOppositeCurrency = isARS ? totalCost / dolarVenta : totalCost * dolarVenta;
			const earningsOppositeCurrency = isARS ? totalEarnings / dolarVenta : totalEarnings * dolarVenta;

			// Determinar estado del pago según el medio y la configuración POS
			const hasTransfer = data.splitPayments.some(
				p => (p.method as string) === PaymentType.BANK_TRANSFER ||
					(p.method as string) === PaymentType.ALIAS_TRANSFER ||
					(p.method as string) === 'Transferencia' ||
					(p.method as string) === 'BANK_TRANSFER'
			);

			const hasCurrentAccount = data.splitPayments.some(
				p => (p.method as string) === PaymentType.CURRENT_ACCOUNT ||
					(p.method as string)?.toUpperCase() === 'FIADO' ||
					(p.method as string)?.toUpperCase() === 'CURRENT_ACCOUNT' ||
					(p.method as string) === 'Cuenta Corriente'
			);

			if (hasCurrentAccount && !data.userId) {
				throw new AppError('Cliente requerido', 'Para ventas fiadas o en cuenta corriente es obligatorio asociar un cliente registrado.', 400);
			}

			const currentAccountAmount = data.splitPayments
				.filter(p => (p.method as string) === PaymentType.CURRENT_ACCOUNT ||
					(p.method as string)?.toUpperCase() === 'FIADO' ||
					(p.method as string)?.toUpperCase() === 'CURRENT_ACCOUNT' ||
					(p.method as string) === 'Cuenta Corriente')
				.reduce((acc, p) => acc + p.amount, 0);

			let paymentStatus = PaymentStatus.APPROVED;
			if (hasCurrentAccount) {
				paymentStatus = PaymentStatus.PENDING;
			} else if (hasTransfer) {
				const isStrictMode = config.posConfig?.transferValidationMode === 'strict_admin_approval';
				if (isStrictMode || data.paymentReceipt) {
					paymentStatus = PaymentStatus.WAITING_CONFIRMATION;
				}
			}

			// 7. Crear el Order record
			const newOrder = await models.Order.create({
				user: data.userId,
				seller: data.sellerId,
				saleType: SaleType.LOCAL,
				status: OrderStatus.DELIVERED, // entregado en mostrador
				items: orderItems,
				shippingInfo: {
					type: ShippingType.PICKUP,
					cost: 0
				},
				paymentInfo: {
					method: data.splitPayments[0]?.method || PaymentType.CASH,
					amount: totalCost,
					status: paymentStatus,
					paymentDate: paymentStatus === PaymentStatus.APPROVED ? new Date() : undefined,
					paymentReceipt: data.paymentReceipt
				},
				splitPayments: data.splitPayments,
				total: totalCost,
				totalOppositeCurrency,
				earnings: totalEarnings,
				earningsOppositeCurrency,
				exchangeRateSnapshot: dolarVenta,
				orderNumber: this.generateOrderNumber(),
				notes: data.notes,
				history: [{
					status: OrderStatus.DELIVERED,
					timestamp: new Date(),
					note: hasTransfer && paymentStatus === PaymentStatus.WAITING_CONFIRMATION
						? 'Venta presencial registrada con comprobante de transferencia pendiente de validación'
						: 'Venta presencial en local'
				}]
			});

			// Si hubo pago a cuenta corriente / fiado, asentar el cargo en el libro mayor
			if (hasCurrentAccount && currentAccountAmount > 0 && data.userId) {
				const { AccountMovementService } = await import('./accountMovement.service');
				await AccountMovementService.recordCharge(
					models,
					data.userId,
					currentAccountAmount,
					newOrder._id.toString(),
					data.sellerId || data.userId,
					`Compra fiada en mostrador #${newOrder.orderNumber}`
				);
			}

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
	 * Aprueba una transferencia bancaria (local u online) verificada por el Admin
	 */
	static approveTransferPayment = OrderPaymentService.approveTransferPayment;

	/**
	 * Estadísticas del día en la tienda física/online
	 */
	static getDailyStats = OrderStatsService.getDailyStats;

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

	/**
	 * Estadísticas de ventas por rango (día, semana, mes, año).
	 * Incluye órdenes aprobadas, métricas de cancelaciones/reembolsos, top productos y KPIs avanzados.
	 */
	static getSalesStats = OrderStatsService.getSalesStats;

	static attachPaymentReceipt = OrderPaymentService.attachPaymentReceipt;
}
