import { Response } from 'express';
import { GetnetService } from '@/services/getnet.service';
import { EcommerceService } from '@/services/ecommerce.service';
import { OrderService } from '@/services/order.service';
import { AppError } from '@/errors/app.error';
import { TenantRequest } from '@/middleware/tenant';

export class GetnetController {
	/**
	 * Inicia la sesión de Web Checkout para una orden específica
	 */
	static async createCheckoutSession(req: TenantRequest, res: Response) {
		const models = req.models;
		const tenantSlug = req.tenant?.slug || 'vura';
		const { orderId } = req.body;

		if (!models) {
			throw new AppError('Tenant missing', 'No se pudo identificar la tienda', 400);
		}

		if (!orderId) {
			throw new AppError('Order ID required', 'El ID de la orden es obligatorio', 400);
		}

		const config = await EcommerceService.getConfig(models);
		const getnetConfig = config.paymentGateways?.getnet;

		if (!getnetConfig?.active || !getnetConfig.clientId || !getnetConfig.clientSecret) {
			throw new AppError('Getnet inactive', 'Getnet no está configurado o activo en esta tienda', 400);
		}

		const order = await OrderService.getOrderById(models, orderId);
		if (!order) {
			throw new AppError('Order not found', 'Orden no encontrada', 404);
		}

		const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
		const host = req.get('host') || 'api.vura.com.ar';
		const clientBaseUrl = config.callbackURLs?.success
			? new URL(config.callbackURLs.success).origin
			: `${protocol}://${host}`;

		const returnUrls = {
			success: config.callbackURLs?.success || `${clientBaseUrl}/order/confirmed/${orderId}`,
			failure: config.callbackURLs?.fail || `${clientBaseUrl}/order/pay/${orderId}?status=rejected`,
			pending: `${clientBaseUrl}/order/pay/${orderId}?status=pending`
		};

		const notificationUrl = `${protocol}://${host}/api/webhooks/getnet/${tenantSlug}`;

		const userObj = order.user as any;
		const shippingAddress = order.shippingInfo?.shippingAddress;

		const session = await GetnetService.createWebCheckoutSession({
			orderId: (order._id as any).toString(),
			amount: order.finance.total,
			currency: 'ARS',
			description: `Compra en ${config.name || 'NexoCommerce'} - Orden #${order.orderNumber || orderId}`,
			customer: {
				first_name: shippingAddress?.recipientName || userObj?.name || 'Cliente',
				last_name: '',
				email: userObj?.email || 'cliente@vura.com.ar',
				phone_number: shippingAddress?.phone || ''
			},
			items: order.items.map(item => ({
				name: item.productSnapshot?.model || item.productSnapshot?.brand || 'Producto',
				quantity: item.quantity,
				unit_price: item.price
			})),
			maxInstallments: getnetConfig.maxInstallments || 6,
			returnUrls,
			notificationUrl,
			credentials: {
				clientId: getnetConfig.clientId,
				clientSecret: getnetConfig.clientSecret
			},
			environment: getnetConfig.environment || 'sandbox'
		});

		// Guardar transaction ID en la orden
		order.paymentInfo.transactionId = session.checkoutId;
		await order.save();

		return res.status(200).json({
			status: 'success',
			data: {
				checkoutId: session.checkoutId,
				initPointUrl: session.initPointUrl,
				checkoutMode: getnetConfig.checkoutMode || 'redirect'
			}
		});
	}

	/**
	 * Webhook para recibir notificaciones de pago desde Getnet
	 */
	static async handleWebhook(req: TenantRequest, res: Response) {
		const models = req.models;
		const tenantSlug = req.params.tenantSlug || req.tenant?.slug || 'vura';

		if (!models) {
			return res.status(200).json({ status: 'ignored', message: 'No tenant found' });
		}

		try {
			const body = req.body;
			const orderId = body.order_id || body.external_reference || body.orderId;

			if (!orderId) {
				return res.status(200).json({ status: 'ignored', message: 'No order_id in webhook' });
			}

			await OrderService.confirmGetnetPayment(models, orderId, body, tenantSlug);

			return res.status(200).json({ status: 'success', message: 'Webhook processed' });
		} catch (error) {
			console.error('Error in Getnet webhook:', error);
			return res.status(200).json({ status: 'error', message: 'Error processing webhook' });
		}
	}
}
