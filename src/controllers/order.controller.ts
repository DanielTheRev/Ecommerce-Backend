import {
	CreateOrderDTO,
	OrderStatus,
	PaymentStatus,
	updatePaymentStatusDTO,
	updateShippingStatusDTO
} from '@/interfaces/order.interface';
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
	try {
		const userId = req.user?.id;
		console.log('new order request by user:', userId);
		const { order, extras } = await OrderService.createOrder(req.body as CreateOrderDTO, userId!);

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

		const userOrders = await OrderService.getOrdersByUserId(user!.id);
		return res.json({
			message: 'Órdenes obtenidas exitosamente',
			orders: userOrders
		});
	} catch (error) {
		return next(error);
	}
};

// Obtener una orden específica por ID
export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const { id } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		const order = await OrderService.getOrderById(id);

		// verify order ownership
		if (order.user._id.toString() !== userId && req.user?.role !== 'admin') {
			return res.status(403).json({ message: 'No tienes permiso para ver esta orden' });
		}

		return res.json(order);
	} catch (error) {
		return next(error);
	}
};

// update order status (only admin)
export const updatePaymentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { orderID } = req.body as updatePaymentStatusDTO;
	try {
		const order = await OrderService.updatePaymentStatus({ orderID });
		//todo implementación de notificaciones via socket
		socketManager.notifyClient(
			order.user._id.toString(),
			'Pago recibido con éxito',
			'paymentStatus',
			order
		);
		return res.status(200).json({ message: 'Pago actualizado con éxito', orderUpdated: order });
	} catch (error) {
		return next(error);
	}
};

export const updateShippingStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { orderID } = req.body as updateShippingStatusDTO;
	try {
		const order = await OrderService.updateOrderShippingStatus(orderID, OrderStatus.SHIPPED);
		socketManager.notifyClient(
			order.user._id.toString(),
			'Compra enviada con éxito',
			'shippingStatus',
			order
		);
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

// Obtener todas las órdenes (solo admin)
// Función mejorada para obtener todas las órdenes
export const getAllOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const { status, userId, dateRange } = req.query;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const query = {
			status: (status as string) || 'all',
			userId: (userId as string) || '',
			dateRange: (dateRange as string) || 'all',
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
