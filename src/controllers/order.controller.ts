import {
	CreateOrderDTO,
	OrderStatus,
	PaymentStatus,
	updatePaymentStatusDTO,
	updateShippingStatusDTO
} from '@/interfaces/order.interface';
import { NotificationSeverity, NotificationType } from '@/interfaces/notification.interface';
import { UalaOrderStatus, UalaWebhook } from '@/interfaces/ualaWebhook.interface';
import { AuthRequest } from '@/middleware/auth';
import { OrderService } from '@/services/order.service';
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
	const id = req.query.id;
	const order = await OrderService.getOrderById(id as string);
	if (!order) {
		console.log('ERROR AL ACTUALIZAR PAGO DE UNA ORDEN, NO SE ENCONTRÓ');
		console.log('ID de la orden =>', id);
		return res.status(200);
	}
	const newStatus =
		data.status === UalaOrderStatus.Aprobado ? PaymentStatus.APPROVED : PaymentStatus.REJECTED;
	await OrderService.updateOrderStatus(order.id, newStatus);
	return res.sendStatus(200);
};

// Crear nueva orden
export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
	if (!req.user) {
		return res.status(401).json({ message: 'Usuario no autenticado' });
	}
	try {
		const userId = req.user._id;
		const { order, extras } = await OrderService.createOrder(req.body as CreateOrderDTO, userId);
		socketManager.notifyNewOrderToAdmins(order);

		return res.status(201).json({
			message: 'Orden creada exitosamente',
			order: order,
			extras
		});
	} catch (error) {
		return next(error);
	}
};

// Obtener todas las órdenes del usuario autenticado
export const getUserOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
		const userOrders = await OrderService.getOrdersByUserId(user!._id as string, query);
		return res.json(userOrders);
	} catch (error) {
		return next(error);
	}
};

// Obtener una orden específica por ID
export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const { id } = req.params;
		const userId = req.user?._id;
		console.log({ productID: id, userID: userId });

		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		const order = await OrderService.getOrderById(id);

		// verify order ownership
		if (order.user._id.toString() !== userId.toString()) {
			return res.status(403).json({ message: 'No tienes permiso para ver esta orden' });
		}

		return res.json(order);
	} catch (error) {
		return next(error);
	}
};

// update order status (only admin)
export const updatePaymentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { orderID, status } = req.body as updatePaymentStatusDTO;
	try {
		const order = await OrderService.updatePaymentStatus({ orderID, status });

		// Notificar al cliente
		socketManager.notifyClient(order.user._id.toString(), {
			type: NotificationType.PAYMENT_SUCCESS,
			title: 'Pago Aprobado',
			message: `Tu pago de $${order.total} fue procesado correctamente.`,
			severity: NotificationSeverity.SUCCESS,
			link: `/orders/${order._id}`,
			data: order
		});
		return res.status(200).json({ message: 'Pago actualizado con éxito', orderUpdated: order });
	} catch (error) {
		return next(error);
	}
};

export const updateShippingStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { orderID, status } = req.body as updateShippingStatusDTO;
	try {
		const order = await OrderService.updateOrderShippingStatus({ orderID, status });
		socketManager.notifyClient(order.user._id.toString(), {
			type: NotificationType.ORDER_STATUS_CHANGED,
			title: 'Estado de Envío Actualizado',
			message: `Tu pedido ahora está: ${status}`,
			severity: NotificationSeverity.INFO,
			link: `/orders/${order._id}`,
			data: order
		});
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
	try {
		const { id } = req.params;
		const userId = req.user!.id;
		const role = req.user!.role;

		const updatedOrder = await OrderService.cancelOrder(id, userId, role);

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
		const response = await OrderService.getAllOrders(req.user!.role, query);

		return res.json(response);
	} catch (error) {
		return next(error);
	}
};

// Obtener estadísticas de órdenes (solo admin)
export const getOrderStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const role = req.user!.role;
		const data = await OrderService.getOrderStats(role);

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
