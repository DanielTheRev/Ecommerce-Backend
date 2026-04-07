import { NotificationSeverity, NotificationType } from '@/interfaces/notification.interface';
import {
	CreateOrderDTO,
	updatePaymentStatusDTO,
	updateShippingStatusDTO
} from '@/interfaces/order.interface';
import { UalaWebhook } from '@/interfaces/ualaWebhook.interface';
import { AuthRequest } from '@/middleware/auth';
import { EcommerceService } from '@/services/ecommerce.service';
import { MercadoPagoService } from '@/services/mercadopago.service';
import { OrderService } from '@/services/order.service';
import { ReceiptService } from '@/services/receipt.service';
import { socketManager } from '@/sockets/socketManager';
import { NextFunction, Response } from 'express';
import UalaApiCheckout from 'ualabis-nodejs';

/* get failed notifications from Uala */
export const getNotificationsUala = async (req: AuthRequest, res: Response) => {
	const notifications = await UalaApiCheckout.getFailedNotifications();
	return res.json({
		notifications
	});
};

/* Uala webhook handler */
export const ualaWebhook = async (req: AuthRequest, res: Response) => {
	console.log('Uala biss notification received');
	const data = req.body as UalaWebhook;
	const id = req.query.id as string;

	try {
		const order = await OrderService.confirmCardPayment(req.models!, id, data.status);
		if (req.tenant) {
			socketManager.notifyOrderUpdatedToAdmins(req.tenant.slug, order, 'payment');
		}
	} catch (error) {
		console.error('Error processing Uala webhook:', error);
	}
	return res.sendStatus(200);
};

/* MercadoPago webhook handler */
export const mercadopagoWebhook = async (req: AuthRequest, res: Response) => {
	console.log('MercadoPago notification received:', req.body);

	const xSignature = req.headers['x-signature'] as string;
	const xRequestId = req.headers['x-request-id'] as string;
	const dataId = (req.query['data.id'] || req.body.data?.id) as string;
	const type = (req.query.type || req.body.type) as string;

	try {
		const config = await EcommerceService.getConfig(req.models!);
		const mpConfig = config.paymentGateways.mercadopago;

		// 1. Validar firma si el secreto está configurado
		if (mpConfig.webhookSecret && mpConfig.webhookSecret !== 'no asignado') {
			const isValid = MercadoPagoService.validateSignature(
				mpConfig.webhookSecret,
				xSignature,
				xRequestId,
				dataId
			);

			if (!isValid) {
				console.warn('❌ Firma de webhook de Mercado Pago inválida');
				return res.sendStatus(401);
			}
		}

		// 2. Procesar según el tipo de evento
		// El Checkout API (v1/orders) envía el tipo 'order'
		if (type === 'order' || req.body.action?.startsWith('order.')) {
			const mpOrderId = dataId || req.body.data?.id;

			if (mpOrderId) {
				// Obtenemos los detalles de la orden para encontrar el external_reference (nuestro internal orderId)
				const mpOrder = await MercadoPagoService.getOrder(mpConfig.accessToken, mpOrderId);
				const internalOrderId = mpOrder.external_reference;

				if (internalOrderId) {
					// Buscamos si hay pagos aprobados en esta orden
					console.log('mpOrder');
					console.log(JSON.stringify(mpOrder));
					// const approvedPayment = mpOrder.transactions?.payments?.find((p: any) => p.status === 'approved');
					const approvedPayment = mpOrder.status_detail === 'accredited' && mpOrder.status === 'processed';

					if (approvedPayment) {
						const order = await OrderService.confirmMercadoPagoPayment(req.models!, internalOrderId, mpOrder.transactions.payments[0]);
						console.log(`✅ Pago de MercadoPago procesado: ${mpOrder.id} para la orden: ${internalOrderId}`);

						if (req.tenant) {
							socketManager.notifyOrderUpdatedToAdmins(req.tenant.slug, order, 'payment');
						}


					} else {
						console.log(`ℹ️ Orden de MP ${mpOrderId} recibida, pero sin pagos aprobados aún.`);
					}
				}
			}
		}
		// Fallback para notificaciones de tipo 'payment' directas (legacy o configuraciones manuales)
		else if (type === 'payment') {
			const paymentId = dataId || req.body.data?.id;
			const internalOrderId = req.query.id as string; // external_reference pasado via query param en notification_url

			if (paymentId && internalOrderId) {
				const order = await OrderService.confirmMercadoPagoPayment(req.models!, internalOrderId, paymentId);
				console.log(`✅ Pago de MercadoPago (legacy/direct) procesado: ${paymentId} para la orden: ${internalOrderId}`);

				if (req.tenant) {
					socketManager.notifyOrderUpdatedToAdmins(req.tenant.slug, order, 'payment');
				}
			}
		}

	} catch (error) {
		console.error('Error processing MercadoPago webhook:', error);
	}

	// Siempre respondemos 200 para que MP deje de reintentar
	return res.sendStatus(200);
};

// Crear nueva orden
export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const userId = req.user ? req.user._id : undefined;
		const newOrderDTO = req.body as CreateOrderDTO;
		const baseUrl = `${req.protocol}://${req.get('host')}`;
		const { order, safeOrder, extras } = await OrderService.createOrder(req.models!, newOrderDTO, userId, req.tenant!.slug, baseUrl);

		if (req.tenant) {
			socketManager.notifyNewOrderToAdmins(req.tenant.slug, order);
		}
		return res.status(201).json({
			message: 'Orden creada exitosamente',
			order: safeOrder,
			extras
		});
	} catch (error) {
		console.log(error);
		return next(error);
	}
};

// Crear orden de venta local en local físico / mostrador (employee, admin)
export const createLocalOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Create local order');
	try {
		const sellerId = req.user!._id.toString();
		const data = req.body; // Debería contener items, splitPayments, userId (opcional), notes (opcional)

		const newOrder = await OrderService.createLocalOrder(req.models!, {
			items: data.items,
			splitPayments: data.splitPayments,
			sellerId: sellerId,
			userId: data.userId,
			notes: data.notes
		});

		if (req.tenant) {
			socketManager.notifyNewOrderToAdmins(req.tenant.slug, newOrder);
		}

		return res.status(201).json({
			message: 'Venta local registrada con éxito',
			order: newOrder
		});
	} catch (error) {
		console.log(error);
		return next(error);
	}
};

// Obtener todas las órdenes del usuario autenticado
export const getUserOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Get user orders');
	try {
		const user = req.user;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const status = req.query.status as string;
		const dateRange = req.query.dateRange as string;
		const query = {
			status: (status as string) || '',
			dateRange: (dateRange as string) || '',
			page,
			limit
		};
		const userOrders = await OrderService.getOrdersByUserId(req.models!, user!._id as string, query);
		return res.json(userOrders);
	} catch (error) {
		return next(error);
	}
};

// Obtener una orden específica por ID
export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const { id, track } = req.params;
		const userId = req.user?._id;

		if (track) {
			const order = await OrderService.getOrderById(req.models!, id);
			return res.json(order);
		}
		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		const order = await OrderService.getOrderById(req.models!, id);
		// verify order ownership
		if (order.user?._id.toString() !== userId.toString()) {
			return res.status(403).json({ message: 'No tienes permiso para ver esta orden' });
		}

		return res.json(order);
	} catch (error) {
		return next(error);
	}
};

export const getOrderByIdAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Get order by id admin');
	try {
		const { id } = req.params;
		const userId = req.user?._id;

		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		const order = await OrderService.getFullyOrderBy(req.models!, { _id: id });


		return res.json(order);
	} catch (error) {
		return next(error);
	}
};

// update order status (only admin)
export const updatePaymentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Update payment status');
	const { orderID, status } = req.body as updatePaymentStatusDTO;
	try {
		const order = await OrderService.updatePaymentStatus(req.models!, { orderID, status });

		// Notificar al cliente
		if (order.user) {
			socketManager.notifyClient(order.user._id.toString(), {
				type: NotificationType.PAYMENT_SUCCESS,
				title: 'Pago Aprobado',
				message: `Tu pago de $${order.total} fue procesado correctamente.`,
				severity: NotificationSeverity.SUCCESS,
				link: `/orders/${order._id}`,
				data: order
			});
		}

		if (req.tenant) {
			socketManager.notifyOrderUpdatedToAdmins(req.tenant.slug, order, 'payment');
		}

		return res.status(200).json({ message: 'Pago actualizado con éxito', orderUpdated: order });
	} catch (error) {
		return next(error);
	}
};

export const updateShippingStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Update shipping status');
	const { orderID, status } = req.body as updateShippingStatusDTO;
	try {
		const order = await OrderService.updateOrderShippingStatus(req.models!, { orderID, status });
		if (order.user) {
			socketManager.notifyClient(order.user._id.toString(), {
				type: NotificationType.ORDER_STATUS_CHANGED,
				title: 'Estado de Envío Actualizado',
				message: `Tu pedido ahora está: ${status}`,
				severity: NotificationSeverity.INFO,
				link: `/orders/${order._id}`,
				data: order
			});
		}

		if (req.tenant) {
			socketManager.notifyOrderUpdatedToAdmins(req.tenant.slug, order, 'shipping');
		}

		return res.json({
			message: 'Envío actualizado con éxito',
			orderUpdated: order
		});
	} catch (error) {
		return next(error);
	}
};

// Cancelar una orden (solo si está en estado pending)
export const cancelOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Cancel order');
	try {
		const { id } = req.params;
		const userId = req.user!._id;
		const role = req.user!.role;

		const updatedOrder = await OrderService.cancelOrder(req.models!, id, userId, role);

		return res.json({
			message: 'Orden cancelada exitosamente',
			order: updatedOrder
		});
	} catch (error) {
		return next(error);
	}
};

// Obtener todas las órdenes (only admin)
export const getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Get all orders');
	try {
		const { status, userId, dateRange } = req.query;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const query = {
			status: (status as string) || '',
			userId: (userId as string) || '',
			dateRange: (dateRange as string) || '',
			page,
			limit
		};
		const response = await OrderService.getAllOrders(req.models!, req.user!.role, query);

		return res.json(response);
	} catch (error) {
		return next(error);
	}
};

// Obtener estadísticas de órdenes (solo admin)
export const getOrderStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Get order stats');
	try {
		const role = req.user!.role;
		const data = await OrderService.getOrderStats(req.models!, role);

		return res.json({
			message: 'Estadísticas obtenidas exitosamente',
			stats: {
				totalOrders: data.totalOrders,
				ordersByStatus: {
					pending: data.pendingOrders,
					processing: data.processingOrders,
					shipped: data.shippedOrders,
					delivered: data.deliveredOrders,
					cancelled: data.cancelledOrders
				},
				totalRevenue: data.totalRevenue[0]?.total || 0
			}
		});
	} catch (error) {
		return next(error);
	}
};

// Obtener estadísticas diarias de ventas (solo admin)
export const getDailyStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Get daily stats');
	try {
		const { date } = req.query; // Puede pasar "2023-11-20"
		const stats = await OrderService.getDailyStats(req.models!, date as string);
		console.log(stats);
		return res.json(stats);
	} catch (error) {
		console.log(error);
		return next(error);
	}
};

// Rastreo de orden para clientes
export const trackOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Track order');
	try {
		const orderNumber = req.query.orderNumber as string;
		const email = req.query.email as string;

		const orderData = await OrderService.trackOrder(req.models!, orderNumber, email);

		return res.status(200).json(orderData);
	} catch (error) {
		return next(error);
	}
};

// Obtener ticket de orden
export const getTicket = async (req: AuthRequest, res: Response, next: NextFunction) => {
	console.log('Get ticket');
	try {
		const { id } = req.params;
		const order = await OrderService.getFullyOrderBy(req.models!, { _id: id }) as any;

		if (!order) {
			return res.status(404).json({ message: 'Orden no encontrada' });
		}

		const pdfBuffer = await ReceiptService.generateThermalReceipt(req.models!, order);

		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `inline; filename="ticket-${order.orderNumber}.pdf"`);

		return res.end(pdfBuffer);
	} catch (error) {
		return next(error);
	}
};
