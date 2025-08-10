import { Request, Response } from 'express';
import { socketManager } from '../sockets/socketManager';
import { ObjectId } from 'mongoose';
import UalaApiCheckout from 'ualabis-nodejs';
import { CreateOrderDTO } from '../interfaces/order.interface';
import { UalaOrderStatus, UalaWebhook } from '../interfaces/ualaWebhook.interface';
import { AuthRequest } from '../middleware/auth';
import Order, { OrderStatus, PaymentStatus } from '../models/Order';
import { PaymentType } from '../models/PaymentMethod';
import { Product } from '../models/Product';
import { ShippingType } from '../models/ShippingOption';
import { PaymentService } from '../services/PaymentService';

// get notifications uala

export const getNotificationsUala = async (req: AuthRequest, res: Response) => {
	const notifications = await UalaApiCheckout.getFailedNotifications();
	return res.json({
		notifications
	});
};

//test uala
// export const testOrderAndUala = async (req: AuthRequest, res: Response) => {
// 	const { items, shippingMethod, paymentMethod } = req.body as {
// 		items: {
// 			productId: string;
// 			name: string;
// 			price: number;
// 			quantity: number;
// 			image: string;
// 		}[];
// 		total: number;
// 		shippingMethod: {
// 			type: IShippingOption;
// 			pickupPoint: IPickupPoint;
// 		};
// 		paymentMethod: IPaymentMethod;
// 	};
// 	const itemsFound = await Product.find({
// 		_id: { $in: items.map((item) => item.productId) }
// 	});

// 	if (itemsFound.length <= 0)
// 		return res.status(404).json({ message: 'No se encontraron los productos' });

// 	const itemsMapped = itemsFound.map((product) => {
// 		const itemInTheCart = items.find((e) => e.productId === product._id.toString());
// 		return {
// 			data: product,
// 			quantity: itemInTheCart?.quantity || 0
// 		};
// 	});

// 	const paymentService = new PaymentService(
// 		itemsMapped,
// 		paymentMethod.type,
// 		shippingMethod.type.cost
// 	);
// 	const finalCost = paymentService.getFinalCost();
// 	const description = paymentService.getDescriptionQuantity();

// 	const order = await UalaApiCheckout.createOrder({
// 		amount: 10,
// 		callbackSuccess:
// 			'https://sections-reviewing-relation-spice.trycloudflare.com/compra-completada',
// 		callbackFail:
// 			'https://www.google.com/search?q=compra+fallida+despegar&rlz=1C1VDKB_esAR1056AR1056&oq=compra+fallida&gs_lcrp=EgZjaHJvbWUqBwgAEAAYgAQyBwgAEAAYgAQyCQgBEEUYORiABDIJCAIQABgKGIAEMgcIAxAAGIAEMgkIBBAAGAoYgAQyCQgFEAAYChiABDIJCAYQABgKGIAEMgkIBxAAGAoYgAQyCQgIEAAYChiABDIJCAkQABgKGIAE0gEIMzEwMmowajeoAgCwAgA&sourceid=chrome&ie=UTF-8',
// 		description,
// 		notificationUrl:
// 			'https://might-darwin-shapes-deeper.trycloudflare.com/api/orders/ualabis-notification'
// 	});

// 	const generatedOrder = await UalaApiCheckout.getOrder(order.uuid);

// 	console.log(generatedOrder);
// 	return res.json({
// 		message: ' Estamos trabajando en eso',
// 		order
// 	});
// };

// Endpoint para que uala me notifique la orden.
export const ualaWebhook = async (req: AuthRequest, res: Response) => {
	console.log('Se recibió un notificación de uala biss');
	const data = req.body as UalaWebhook;
	const id = req.query.id;
	const order = await Order.findById(id);
	if (!order) {
		console.log('ERROR AL ACTUALIZAR PAGO DE UNA ORDEN, NO SE ENCONTRÓ');
		console.log('ID de la orden =>', id);
		return res.status(200);
	}
	if (data.status === UalaOrderStatus.Aprobado) {
		order.paymentInfo.status = PaymentStatus.APPROVED;
	} else {
		order.paymentInfo.status = PaymentStatus.REJECTED;
	}
	await order.save();
	return res.sendStatus(200);
};

// Crear nueva orden
export const createOrder = async (req: AuthRequest, res: Response) => {
	try {
		const { items, shippingMethod, paymentMethod } = req.body as CreateOrderDTO;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		// Validar que los items del carrito no estén vacíos
		if (!items || items.length === 0) {
			return res.status(400).json({ message: 'La orden debe tener al menos un producto' });
		}

		// Validar precios y procesar items del carrito
		let itemsFound = await Product.find({
			_id: { $in: items.map((item) => item.productId) }
		});

		if (itemsFound.length <= 0)
			return res
				.status(500)
				.json({ message: 'Hubo un error en el servidor, le pedimos disculpas' });

		for (const item of items) {
			// Verificar que el producto existe
			const product = await Product.findById(item.productId);
			if (!product) {
				return res
					.status(404)
					.json({ message: `Producto con el nombre ${item.name} no encontrado` });
			}

			// Verificar stock disponible
			if (product.stock < item.quantity) {
				return res.status(400).json({
					message: `Stock insuficiente para ${product.brand} ${product.model}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`
				});
			}
		}

		const itemsFormat = itemsFound.map((product) => {
			const itemInTheCart = items.find((e) => e.productId === product._id.toString());
			return {
				data: product,
				quantity: itemInTheCart?.quantity || 0
			};
		});

		const paymentService = new PaymentService(
			itemsFormat,
			paymentMethod.type,
			shippingMethod.type.cost
		);

		const status =
			shippingMethod.type.type === ShippingType.HOME_DELIVERY
				? OrderStatus.PROCESSING_SHIPPING
				: OrderStatus.PENDING;

		// Crear la orden
		const order = new Order({
			user: userId,
			status,
			items: paymentService.getOrderProcessedItems(),
			shippingInfo: {
				type: shippingMethod.type.type,
				pickupPoint: shippingMethod.pickupPoint,
				cost: shippingMethod.type.cost
			},
			paymentInfo: {
				method: paymentMethod.type,
				amount: paymentService.getFinalCost()
			},
			total: paymentService.getFinalCost()
			// notes
		});

		let extras;
		if (paymentMethod.type === PaymentType.CARD) {
			const { ualaOrder, error } = await paymentService.withUalaBiss(order.id);
			order.paymentInfo.transactionId = ualaOrder?.uuid || '';
			if (error) {
				return res.status(500).json({ message: 'Error al procesar el pago' });
			}
			extras = ualaOrder;
		}

		await order.save();

		// Reducir stock de productos
		for (const item of paymentService.getOrderProcessedItems()) {
			await Product.findByIdAndUpdate(
				item.product,
				{ $inc: { stock: -item.quantity } },
				{ new: true }
			);
		}

		// Poblar la orden con información del usuario y productos
		const populatedOrder = await Order.findById(order._id)
			.populate('user', 'name email')
			.populate('items.product', 'name price images');

		// Notificar nueva transacción a admins vía WebSocket
		//todo implementación de notificaciones via socket
		socketManager.notifyOrderStateToAdmin('order_new', populatedOrder, 'Nueva orden recibida');
		// socketManager.notifyTransaction({
		// 	orderId: populatedOrder?._id,
		// 	user: populatedOrder?.user,
		// 	total: populatedOrder?.total,
		// 	status: populatedOrder?.status,
		// 	paymentMethod: populatedOrder?.paymentInfo?.method,
		// 	items: populatedOrder?.items?.map((item) => ({
		// 		product: item.product,
		// 		quantity: item.quantity,
		// 		price: item.price
		// 	}))
		// });

		return res.status(201).json({
			message: 'Orden creada exitosamente',
			order: populatedOrder,
			extras
		});
	} catch (error) {
		console.error('Error al crear orden:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
};

// Obtener todas las órdenes del usuario autenticado
export const getUserOrders = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: 'Usuario no autenticado' });

		const orders = await Order.findByUser(user._id as ObjectId);

		return res.json({
			message: 'Órdenes obtenidas exitosamente',
			orders: orders
		});
	} catch (error) {
		console.error('Error al obtener órdenes del usuario:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
};

// Obtener una orden específica por ID
export const getOrderById = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		const order = await Order.findById(id);

		if (!order) {
			return res.status(404).json({ message: 'Orden no encontrada' });
		}

		// Verificar que la orden pertenece al usuario (excepto si es admin)
		if (order.user._id.toString() !== userId && req.user?.role !== 'admin') {
			return res.status(403).json({ message: 'No tienes permiso para ver esta orden' });
		}

		return res.json({
			message: 'Orden obtenida exitosamente',
			order
		});
	} catch (error) {
		console.error('Error al obtener orden por ID:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
};

// Actualizar estado de una orden (solo admin)
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const { status } = req.body;

		// Verificar que el usuario es admin
		if (req.user?.role !== 'admin') {
			return res.status(403).json({ message: 'No tienes permisos para actualizar órdenes' });
		}

		// Verificar que el estado es válido
		if (!Object.values(OrderStatus).includes(status)) {
			return res.status(400).json({ message: 'Estado de orden inválido' });
		}

		const order = await Order.findById(id);
		if (!order) {
			return res.status(404).json({ message: 'Orden no encontrada' });
		}

		// Actualizar estado
		await order.updateStatus(status);

		const updatedOrder = await Order.findById(id)
			.populate('user', 'name email')
			.populate('items.product', 'name price images');

		// Notificar actualización de orden a admins vía WebSocket
		//todo implementación de notificaciones via socket
		socketManager.notifyClient(
			order.user._id.toString(),
			'Pago recibido con éxito',
			'paymentStatus',
			{
				newState: status
			}
		);
		// socketManager.notifyOrderUpdate({
		// 	orderId: updatedOrder?._id,
		// 	user: updatedOrder?.user,
		// 	previousStatus: order.status,
		// 	newStatus: status,
		// 	total: updatedOrder?.total,
		// 	updatedBy: req.user?.name || 'Admin'
		// });

		return res.json({
			message: 'Estado de orden actualizado exitosamente',
			order: updatedOrder
		});
	} catch (error) {
		console.error('Error al actualizar estado de orden:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
};

// Actualizar estado del pago de una order(client)
export const updatePaymentStatus = async (req: AuthRequest, res: Response) => {
	const { orderID } = req.body as { orderID: string };
	if (!orderID)
		return res.status(404).json({
			message: 'No se brindo id de la compra'
		});
	const order = await Order.findById(orderID)
		.populate('user', 'name email')
		.populate('items.product', 'name price images');
	if (!order) {
		return res.status(404).json({ message: 'Orden no encontrada' });
	}

	let newStatus: string;
	const isCard = PaymentService.theOrderIsPreferredPayment(order.paymentInfo.method);
	if (!isCard) {
		if (!order.paymentInfo.transactionId)
			return res.status(404).json({ message: 'No se encontró número de transacción' });

		const ualaOrder = await PaymentService.getOrderStatus(order.paymentInfo.transactionId);

		if (ualaOrder.error) {
			return res
				.status(500)
				.json({ message: 'Error al actualizar estado de pago, no se encontró orden en uala' });
		}
		newStatus =
			ualaOrder.orderStatus?.status === UalaOrderStatus.Aprobado
				? PaymentStatus.APPROVED
				: PaymentStatus.REJECTED;
	}
	newStatus = PaymentStatus.PAID;
	order.paymentInfo.status = PaymentStatus.PAID;
	await order.save();

	//todo implementación de notificaciones via socket
	socketManager.notifyClient(
		order.user._id.toString(),
		'Pago recibido con éxito',
		'paymentStatus',
		order
	);
	return res.status(200).json({ message: 'Pago actualizado con éxito', orderUpdated: order });
};

// Cancelar una orden (solo si está en estado pending)
export const cancelOrder = async (req: AuthRequest, res: Response) => {
	try {
		const { id } = req.params;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		const order = await Order.findById(id);
		if (!order) {
			return res.status(404).json({ message: 'Orden no encontrada' });
		}

		// Verificar que la orden pertenece al usuario (excepto si es admin)
		if (order.user.toString() !== userId && req.user?.role !== 'admin') {
			return res.status(403).json({ message: 'No tienes permiso para cancelar esta orden' });
		}

		// Solo se puede cancelar si está en estado pending
		if (order.status !== OrderStatus.PENDING) {
			return res
				.status(400)
				.json({ message: 'Solo se pueden cancelar órdenes en estado pendiente' });
		}

		// Actualizar estado a cancelado
		order.status = OrderStatus.CANCELLED;
		order.paymentInfo.status = PaymentStatus.CANCELLED;
		await order.save();

		// Restaurar stock de productos
		for (const item of order.items) {
			await Product.findByIdAndUpdate(
				item.product,
				{ $inc: { stock: item.quantity } },
				{ new: true }
			);
		}

		const updatedOrder = await Order.findById(id)
			.populate('user', 'name email')
			.populate('items.product', 'name price images');

		return res.json({
			message: 'Orden cancelada exitosamente',
			order: updatedOrder
		});
	} catch (error) {
		console.error('Error al cancelar orden:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
};

// Obtener todas las órdenes (solo admin)
// Función mejorada para obtener todas las órdenes
export const getAllOrders = async (req: AuthRequest, res: Response) => {
	try {
		// Verificar que el usuario es admin
		if (req.user?.role !== 'admin') {
			return res.status(403).json({ message: 'No tienes permisos para ver todas las órdenes' });
		}

		const { status, userId, dateRange } = req.query;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;
		const skip = (page - 1) * limit;

		// Construir filtros
		const filters: any = {};

		// Filtro por estado
		if (status) {
			filters.status = status;
		}

		// Filtro por usuario
		if (userId) {
			filters.user = userId;
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

		console.log('🔍 Filtros aplicados:', filters);

		// Obtener órdenes con paginación y populate mejorado
		const orders = await Order.find(filters)
			.populate('user', 'name email profilePhoto role')
			.populate({
				path: 'items.product',
				select: 'name price images description category'
			})
			.sort({ createdAt: -1 }) // Ordenar por fecha de creación descendente
			.skip(skip)
			.limit(limit);

		// Contar total de órdenes con los mismos filtros
		const total = await Order.countDocuments(filters);

		// Estadísticas adicionales (opcional)
		const stats = await Order.aggregate([
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
				status: status || 'all',
				userId: userId || null,
				dateRange: dateRange || 'all'
			}
		};

		console.log(`📊 Devolviendo ${orders.length} órdenes de ${total} totales`);

		return res.json(response);
	} catch (error) {
		console.error('Error al obtener todas las órdenes:', error);
		return res.status(500).json({
			message: 'Error interno del servidor',
			error: process.env.NODE_ENV === 'development' ? error : undefined
		});
	}
};

// Obtener estadísticas de órdenes (solo admin)
export const getOrderStats = async (req: AuthRequest, res: Response) => {
	try {
		// Verificar que el usuario es admin
		if (req.user?.role !== 'admin') {
			return res.status(403).json({ message: 'No tienes permisos para ver estadísticas' });
		}

		const [
			totalOrders,
			pendingOrders,
			processingOrders,
			shippedOrders,
			deliveredOrders,
			cancelledOrders,
			totalRevenue
		] = await Promise.all([
			Order.countDocuments(),
			Order.countDocuments({ status: OrderStatus.PENDING }),
			Order.countDocuments({ status: OrderStatus.PROCESSING_SHIPPING }),
			Order.countDocuments({ status: OrderStatus.SHIPPED }),
			Order.countDocuments({ status: OrderStatus.DELIVERED }),
			Order.countDocuments({ status: OrderStatus.CANCELLED }),
			Order.aggregate([
				{ $match: { status: { $ne: OrderStatus.CANCELLED } } },
				{ $group: { _id: null, total: { $sum: '$total' } } }
			])
		]);

		return res.json({
			message: 'Estadísticas obtenidas exitosamente',
			stats: {
				totalOrders,
				ordersByStatus: {
					pending: pendingOrders,
					processing: processingOrders,
					shipped: shippedOrders,
					delivered: deliveredOrders,
					cancelled: cancelledOrders
				},
				totalRevenue: totalRevenue[0]?.total || 0
			}
		});
	} catch (error) {
		console.error('Error al obtener estadísticas:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
};
