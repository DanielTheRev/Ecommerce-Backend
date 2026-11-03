import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import {
	IOrder,
	IOrderDocument,
	OrderStatus,
	PaymentStatus,
} from '@/interfaces/order.interface';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { UalaOrderStatus } from '@/interfaces/ualaWebhook.interface';
import { PaymentElement } from '@/interfaces/mp_payment.interface';
import { EcommerceService } from '../ecommerce.service';
import { MercadoPagoService } from '../mercadopago.service';
import { PaymentService } from '../Payment.service';
import { ResendService } from '../resend.service';
import { MetaService } from '../meta.service';
import { ImageService } from '../images.service';
import { ProductService } from '../product.service';

export const ADMIN_PRICE_SELECT =
	'+finance.baseCost +finance.earnings +finance.earningsOppositeCurrency +items.productSnapshot.providerSnapshot +items.productSnapshot.finance';

export class OrderPaymentService {
	/**
	 * Actualiza el score ELO y ranking de ventas para los productos de una orden aprobada
	 */
	static async recordOrderRankingSales(models: TenantModels, order: any): Promise<void> {
		try {
			if (!order?.items || !Array.isArray(order.items)) return;
			for (const item of order.items) {
				const prodId = (
					item.productId?._id ||
					item.productId ||
					item.productSnapshot?._id
				)?.toString();
				if (prodId) {
					await ProductService.recordProductSale(models, prodId, item.quantity || 1);
					const { ShopTheLookService } = await import('../shopTheLook.service');
					await ShopTheLookService.recordProductSaleInLooks(models, prodId, item.quantity || 1);
				}
			}
		} catch (err) {
			console.error('[Ranking] Error updating product sales score:', err);
		}
	}

	/**
	 * Confirmación de pago con tarjeta vía pasarela Ualá
	 */
	static async confirmCardPayment(
		models: TenantModels,
		orderID: string,
		status: UalaOrderStatus
	) {
		try {
			const order = await models.Order.findById(orderID)
				.select(ADMIN_PRICE_SELECT)
				.populate([{ path: 'user', select: 'name email' }]);

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			// Validar contra la API oficial de Ualá antes de aprobar
			let isActuallyApproved = status === UalaOrderStatus.Aprobado;
			let ualaInstallments = 1;

			if (isActuallyApproved) {
				if (!order.paymentInfo.transactionId) {
					console.error('❌ Transaction ID missing for card order:', orderID);
					isActuallyApproved = false;
				} else {
					const { orderStatus, error } = await PaymentService.getOrderStatus(
						order.paymentInfo.transactionId
					);
					if (
						error ||
						!orderStatus ||
						((orderStatus as any).status !== UalaOrderStatus.Aprobado &&
							(orderStatus as any).state !== 'APPROVED')
					) {
						console.warn(
							`🚨 [Pago no verificado Ualá] API oficial no reportó aprobación para ${orderID}`
						);
						isActuallyApproved = false;
					} else {
						const paidAmount = Number(
							(orderStatus as any).amount || (orderStatus as any).total || 0
						);
						const expectedTotal = Number(order.finance.total || 0);
						if (paidAmount > 0 && paidAmount < expectedTotal - 1) {
							console.error(
								`🚨 [Fraude Detectado Ualá] Monto pagado ($${paidAmount}) menor al total ($${expectedTotal}) en orden ${orderID}`
							);
							isActuallyApproved = false;
						} else {
							ualaInstallments =
								(orderStatus as any).customer?.card?.installments?.number || 1;
						}
					}
				}
			}

			order.paymentInfo.status = isActuallyApproved
				? PaymentStatus.APPROVED
				: PaymentStatus.REJECTED;

			if (order.paymentInfo.status === PaymentStatus.APPROVED) {
				const itemsForPaymentService = order.items.map((item) => ({
					data: item.productSnapshot as any,
					quantity: item.quantity
				}));

				const paymentService = new PaymentService(
					itemsForPaymentService,
					PaymentType.CARD,
					order.shippingInfo.cost
				);

				order.finance.earnings = paymentService.getEarnings(ualaInstallments);
				order.finance.installments = ualaInstallments;
				order.paymentInfo.paymentDate = new Date();
				order.status = OrderStatus.PROCESSING_SHIPPING;
			} else {
				order.status = OrderStatus.PAYMENT_FAILED;
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

	/**
	 * Confirmación de pago procesado por Mercado Pago (Webhook e IPN)
	 */
	static async confirmMercadoPagoPayment(
		models: TenantModels,
		orderId: string,
		paymentOrId: PaymentElement | string
	) {
		try {
			const config = await EcommerceService.getConfig(models);
			const mpConfig = config.paymentGateways.mercadopago;

			const order = (await models.Order.findById(orderId)
				.select(ADMIN_PRICE_SELECT)
				.populate([{ path: 'user', select: 'name email' }])) as IOrderDocument;

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			let payment: any;
			if (typeof paymentOrId === 'string') {
				payment = await MercadoPagoService.getPaymentStatus(
					mpConfig.accessToken,
					paymentOrId
				);
			} else {
				payment = paymentOrId;
			}

			if (!payment)
				throw new AppError('Payment details not found', 'Detalles de pago no encontrados', 404);

			// Map status/details
			let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
			let orderStatus: OrderStatus = OrderStatus.PENDING_PAYMENT;
			let note = '';

			const status = String(payment.status || '').toLowerCase();
			const statusDetail = String(payment.status_detail || '').toLowerCase();

			if (status === 'approved' || status === 'processed' || statusDetail === 'accredited') {
				const paidAmount = Number(payment.transaction_amount || payment.amount || 0);
				const expectedTotal = Number(order.finance.total || 0);

				if (paidAmount > 0 && paidAmount < expectedTotal - 1) {
					console.error(
						`🚨 [Fraude Detectado MP] Monto pagado ($${paidAmount}) menor al total de la orden ($${expectedTotal}) en orden ${orderId}`
					);
					paymentStatus = PaymentStatus.REJECTED;
					orderStatus = OrderStatus.PAYMENT_FAILED;
					note = `Pago rechazado: Monto recibido ($${paidAmount}) no coincide con el total de la orden ($${expectedTotal})`;
				} else {
					paymentStatus = PaymentStatus.APPROVED;
					orderStatus = OrderStatus.PROCESSING_SHIPPING;
					note = 'Pago acreditado con éxito';
				}
			} else if (
				status === 'in_process' ||
				status === 'processing' ||
				status === 'in_review' ||
				status === 'pending' ||
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
				note = `Pago en proceso: ${payment.status}`;
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
				note = `Pago no aprobado: ${payment.status}`;
			} else {
				paymentStatus = PaymentStatus.PENDING;
				orderStatus = OrderStatus.PENDING_PAYMENT;
				note = `Estado de pago recibido: ${payment.status}`;
			}

			if (
				status === 'cancelled' ||
				status === 'expired' ||
				statusDetail === 'expired' ||
				statusDetail === 'cancelled'
			) {
				paymentStatus = PaymentStatus.CANCELLED;
				orderStatus = OrderStatus.CANCELLED;
			}

			const oldPaymentStatus = order.paymentInfo.status;
			const isAlreadyApproved = oldPaymentStatus === PaymentStatus.APPROVED;
			const isFirstPaymentUpdate =
				!order.paymentInfo.transactionId || order.paymentInfo.transactionId.startsWith('TX-');

			// Actualizar estado del pago
			order.paymentInfo.status = paymentStatus;
			order.status = orderStatus;
			order.paymentInfo.transactionId = String(payment.id);

			order.history.push({
				status: orderStatus,
				timestamp: new Date(),
				note: isAlreadyApproved ? 'Notificación de webhook recibida (pago verificado)' : note,
				target: isAlreadyApproved ? 'admin' : 'all'
			});

			if (!order.paymentInfo.mercadopagoData) {
				order.paymentInfo.mercadopagoData = {
					items: [],
					status: payment.status,
					status_detail: payment.status_detail,
					total_amount: String(
						payment.transaction_amount || payment.amount || order.finance.total
					),
					total_paid_amount: String(
						payment.transaction_amount || payment.amount || order.finance.total
					),
					transactions: { payments: [payment] } as any
				};
			} else {
				order.paymentInfo.mercadopagoData.status = payment.status;
				order.paymentInfo.mercadopagoData.status_detail = payment.status_detail;
				if (!order.paymentInfo.mercadopagoData.transactions) {
					order.paymentInfo.mercadopagoData.transactions = { payments: [] } as any;
				}
				if (!order.paymentInfo.mercadopagoData.transactions.payments) {
					order.paymentInfo.mercadopagoData.transactions.payments = [];
				}
				// Evitar duplicados
				const exists = order.paymentInfo.mercadopagoData.transactions.payments.some(
					(p: any) => String(p.id) === String(payment.id)
				);
				if (!exists) {
					order.paymentInfo.mercadopagoData.transactions.payments.push(payment);
				}
			}

			if (order.paymentInfo.status === PaymentStatus.APPROVED) {
				order.paymentInfo.paymentDate = new Date();

				// Calcular ganancias dinámicas basadas en cuotas si MP nos da el dato
				const installments = payment.payment_method?.installments || 1;

				const itemsForPaymentService = order.items.map((item) => ({
					data: item.productSnapshot as any,
					quantity: item.quantity
				}));

				const paymentService = new PaymentService(
					itemsForPaymentService,
					PaymentType.CARD,
					order.shippingInfo.cost
				);

				order.finance.earnings = paymentService.getEarnings(installments);
				order.finance.installments = installments;

				const rawBaseComm = config.paymentGateways.mercadopago.baseCommission;
				const rawCFT3 = config.paymentGateways.mercadopago.cft3cuotas;
				const rawCFT6 = config.paymentGateways.mercadopago.cft6Cuotas;
				const ivaFactor = 1 + Number(config.taxes.iva) / 100;
				let tasa = Number(rawBaseComm) / 100;
				if (installments > 3) {
					tasa = (Number(rawBaseComm) + Number(rawCFT6)) / 100;
				} else if (installments > 1) {
					tasa = (Number(rawBaseComm) + Number(rawCFT3)) / 100;
				}
				order.finance.paymentGatewayFee = order.finance.total * (tasa * ivaFactor);
			}

			await order.save();

			// Trigger emails & Meta CAPI Purchase
			if (
				order.paymentInfo.status === PaymentStatus.APPROVED &&
				oldPaymentStatus !== PaymentStatus.APPROVED
			) {
				await ResendService.sendOrderConfirmationEmail(
					order.toObject() as unknown as IOrder,
					models
				);
				MetaService.trackPurchaseFromOrder(
					order.toObject(),
					undefined,
					undefined,
					undefined,
					models
				).catch((err) => console.error('[Meta CAPI] Error enviando Purchase event:', err));
				this.recordOrderRankingSales(models, order.toObject()).catch((err) =>
					console.error('[Ranking] Error tracking sale:', err)
				);
			} else if (order.paymentInfo.status === PaymentStatus.PENDING && isFirstPaymentUpdate) {
				await ResendService.sendPaymentInProcessEmail(
					order.toObject() as unknown as IOrder,
					models
				);
			}

			return order;
		} catch (error) {
			console.error('Error in confirmMercadoPagoPayment:', error);
			throw error;
		}
	}

	/**
	 * Confirmación de pago procesado por Getnet (Webhook e IPN)
	 */
	static async confirmGetnetPayment(
		models: TenantModels,
		orderId: string,
		paymentData: any,
		_tenantSlug?: string
	) {
		try {
			const config = await EcommerceService.getConfig(models);
			const getnetConfig = config.paymentGateways?.getnet;

			const order = (await models.Order.findById(orderId)
				.select(ADMIN_PRICE_SELECT)
				.populate([{ path: 'user', select: 'name email' }])) as IOrderDocument;

			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			const oldPaymentStatus = order.paymentInfo.status;
			const isFirstPaymentUpdate = oldPaymentStatus === PaymentStatus.PENDING;

			const status = String(paymentData.status || paymentData.state || '').toLowerCase();
			let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
			let orderStatus: OrderStatus = OrderStatus.PENDING_PAYMENT;

			if (
				status === 'approved' ||
				status === 'paid' ||
				status === 'authorized' ||
				status === 'completed'
			) {
				const paidAmount = Number(paymentData.amount || paymentData.total_amount || 0);
				const expectedTotal = Number(order.finance.total || 0);
				if (paidAmount > 0 && paidAmount < expectedTotal - 1) {
					console.error(
						`🚨 [Fraude Detectado Getnet] Monto pagado ($${paidAmount}) menor al total ($${expectedTotal}) en orden ${orderId}`
					);
					paymentStatus = PaymentStatus.REJECTED;
					orderStatus = OrderStatus.PAYMENT_FAILED;
				} else {
					paymentStatus = PaymentStatus.APPROVED;
					orderStatus = OrderStatus.PROCESSING_SHIPPING;
				}
			} else if (
				status === 'rejected' ||
				status === 'declined' ||
				status === 'failed' ||
				status === 'cancelled'
			) {
				paymentStatus = PaymentStatus.REJECTED;
				orderStatus = OrderStatus.PAYMENT_FAILED;
			} else {
				paymentStatus = PaymentStatus.PENDING;
				orderStatus = OrderStatus.PENDING_PAYMENT;
			}

			const isAlreadyApproved = oldPaymentStatus === PaymentStatus.APPROVED;
			if (!isAlreadyApproved) {
				order.paymentInfo.status = paymentStatus;
				order.status = orderStatus;
			}

			order.paymentInfo.transactionId =
				paymentData.payment_id || paymentData.id || order.paymentInfo.transactionId;

			if (order.paymentInfo.status === PaymentStatus.APPROVED && !isAlreadyApproved) {
				order.paymentInfo.paymentDate = new Date();
				const installments = paymentData.installments || 1;

				const itemsForPaymentService = order.items.map((item) => ({
					data: item.productSnapshot as any,
					quantity: item.quantity
				}));

				const paymentService = new PaymentService(
					itemsForPaymentService,
					PaymentType.CARD,
					order.shippingInfo.cost
				);

				order.finance.earnings = paymentService.getEarnings(installments);
				order.finance.installments = installments;

				const rawBaseComm = getnetConfig?.baseCommission ?? 0.035;
				const rawCFT3 = getnetConfig?.cft3cuotas ?? 0;
				const rawCFT6 = getnetConfig?.cft6Cuotas ?? 10;
				const ivaFactor = 1 + Number(config.taxes.iva) / 100;

				let tasa =
					Number(rawBaseComm) > 1 ? Number(rawBaseComm) / 100 : Number(rawBaseComm);
				if (installments > 3) {
					tasa += Number(rawCFT6) / 100;
				} else if (installments > 1) {
					tasa += Number(rawCFT3) / 100;
				}

				order.finance.paymentGatewayFee = order.finance.total * (tasa * ivaFactor);
			}

			await order.save();

			// Emails & Meta CAPI Purchase
			if (
				order.paymentInfo.status === PaymentStatus.APPROVED &&
				oldPaymentStatus !== PaymentStatus.APPROVED
			) {
				await ResendService.sendOrderConfirmationEmail(
					order.toObject() as unknown as IOrder,
					models
				);
				MetaService.trackPurchaseFromOrder(
					order.toObject(),
					undefined,
					undefined,
					undefined,
					models
				).catch((err) => console.error('[Meta CAPI] Error enviando Purchase event:', err));
				this.recordOrderRankingSales(models, order.toObject()).catch((err) =>
					console.error('[Ranking] Error tracking sale:', err)
				);
			} else if (order.paymentInfo.status === PaymentStatus.PENDING && isFirstPaymentUpdate) {
				await ResendService.sendPaymentInProcessEmail(
					order.toObject() as unknown as IOrder,
					models
				);
			}

			return order;
		} catch (error) {
			console.error('Error confirming Getnet payment:', error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to confirm Getnet payment',
				'Error al confirmar el pago con Getnet',
				500
			);
		}
	}

	/**
	 * Aprueba una transferencia bancaria (local u online) verificada por el Admin
	 */
	static async approveTransferPayment(
		models: TenantModels,
		orderId: string,
		_adminUserId?: string
	) {
		try {
			const order = await models.Order.findById(orderId);
			if (!order) {
				throw new AppError('Orden no encontrada', 'No se encontró la orden especificada', 404);
			}

			order.paymentInfo.status = PaymentStatus.APPROVED;
			order.paymentInfo.paymentDate = new Date();
			order.status = OrderStatus.PROCESSING_SHIPPING;
			order.history.push({
				status: order.status,
				timestamp: new Date(),
				note: `Transferencia bancaria auditada y aprobada por el administrador`
			});

			await order.save();

			// Enviar correo de pago acreditado al comprador y registrar compra en Meta CAPI
			ResendService.sendPaymentReceivedEmail(order.toObject() as unknown as IOrder, models).catch(
				(err) =>
					console.error('[Resend] Error enviando email de pago recibido por transferencia:', err)
			);
			MetaService.trackPurchaseFromOrder(
				order.toObject(),
				undefined,
				undefined,
				undefined,
				models
			).catch((err) => console.error('[Meta CAPI] Error enviando Purchase event:', err));
			this.recordOrderRankingSales(models, order.toObject()).catch((err) =>
				console.error('[Ranking] Error tracking sale:', err)
			);

			const safeOrder = await models.Order.findById(order._id).populate([
				{ path: 'user', select: 'name email' },
				{ path: 'seller', select: 'name' }
			]);

			return safeOrder || order;
		} catch (error) {
			console.error(error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error al aprobar transferencia',
				'No se pudo aprobar la transferencia bancaria.',
				500
			);
		}
	}

	/**
	 * Adjunta el comprobante de transferencia bancaria enviado por el cliente
	 */
	static async attachPaymentReceipt(
		models: TenantModels,
		orderId: string,
		file: Express.Multer.File
	): Promise<IOrderDocument> {
		try {
			if (!orderId)
				throw new AppError('Order ID is required', 'El ID de la orden es requerido', 400);
			if (!file)
				throw new AppError('File is required', 'El archivo del comprobante es requerido', 400);

			const order = await models.Order.findById(orderId);
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);

			// Subir archivo a Cloudinary en la carpeta receipts
			const uploadResult = await ImageService.UploadImage(
				file,
				`receipt-${order.orderNumber || orderId}`,
				'receipts'
			);

			// Actualizar datos de comprobante
			order.paymentInfo.receiptUrl = uploadResult.secure_url;
			order.paymentInfo.receiptUploadedAt = new Date();

			// Registrar entrada en el historial
			order.history.push({
				status: order.status,
				timestamp: new Date(),
				note: 'Comprobante de pago cargado por el cliente'
			});

			await order.save();
			return order;
		} catch (error) {
			if (error instanceof AppError) throw error;
			console.error('Error attaching payment receipt:', error);
			throw new AppError(
				'Failed to attach payment receipt',
				'Error al guardar el comprobante de pago',
				500
			);
		}
	}
}
