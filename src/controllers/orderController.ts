import { Request, Response } from 'express';
import Order, { OrderStatus, PaymentStatus } from '../models/Order';
import { Product } from '../models/Product';
import { AuthRequest } from '../middleware/auth';
import UalaApiCheckout from 'ualabis-nodejs';

//test

export const testOrderAndUala = async (req: AuthRequest, res: Response) => {
	const { items, total, shippingMethod, paymentMethod } = req.body as {
		items: {
			productId: string;
			name: string;
			price: number;
			quantity: number;
			image: string;
		};
		total: number;
		shippingMethod: string;
		paymentMethod: string;
	};
	console.log('La compra es de: ', total);
	const order = await UalaApiCheckout.createOrder({
		amount: total,
		callbackSuccess: 'https://www.google.com/search?q=pago+exitoso',
		callbackFail: 'https://www.google.com/search?q=el+pago+fallo+con+exito',
		description: 'Orden de prueba'
		// notificationUrl: 'http://localhost:4200/Checkout'
	});

	return res.json({
		message: ' Estamos trabajando en eso',
		order
	});
};

// Crear nueva orden
export const createOrder = async (req: AuthRequest, res: Response) => {
	try {
		const { items, shippingAddress, paymentInfo, notes } = req.body;
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ message: 'Usuario no autenticado' });
		}

		// Validar que los items no estén vacíos
		if (!items || items.length === 0) {
			return res.status(400).json({ message: 'La orden debe tener al menos un item' });
		}

		// Validar y procesar items
		const processedItems = [];
		let subtotal = 0;

		for (const item of items) {
			// Verificar que el producto existe
			const product = await Product.findById(item.product);
			if (!product) {
				return res
					.status(404)
					.json({ message: `Producto con ID ${item.product} no encontrado` });
			}

			// Verificar stock disponible
			if (product.stock < item.quantity) {
				return res.status(400).json({
					message: `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${item.quantity}`
				});
			}

			// Crear item procesado con datos actuales del producto
			const processedItem = {
				product: product._id,
				quantity: item.quantity,
				price: product.price,
				name: product.name,
				image: product.image
			};

			processedItems.push(processedItem);
			subtotal += processedItem.price * processedItem.quantity;
		}

		// Calcular impuestos y envío (puedes personalizar esta lógica)
		const tax = subtotal * 0.21; // 21% IVA en Argentina
		const shippingCost = subtotal > 50000 ? 0 : 5000; // Envío gratis para compras mayores a $50,000
		const total = subtotal + tax + shippingCost;

		// Crear la orden
		const order = new Order({
			user: userId,
			items: processedItems,
			shippingAddress,
			paymentInfo: {
				...paymentInfo,
				amount: total
			},
			subtotal,
			tax,
			shippingCost,
			total,
			notes
		});

		await order.save();

		// Reducir stock de productos
		for (const item of processedItems) {
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

		return res.status(201).json({
			message: 'Orden creada exitosamente',
			order: populatedOrder
		});
	} catch (error) {
		console.error('Error al crear orden:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
};

// Obtener todas las órdenes del usuario autenticado
export const getUserOrders = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.user?.id;

		if (!userId) return res.status(401).json({ message: 'Usuario no autenticado' });

		const orders = await Order.findByUser(userId);

		return res.json({
			message: 'Órdenes obtenidas exitosamente',
			orders
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

		const order = await Order.findById(id)
			.populate('user', 'name email')
			.populate('items.product', 'name price images');

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

		return res.json({
			message: 'Estado de orden actualizado exitosamente',
			order: updatedOrder
		});
	} catch (error) {
		console.error('Error al actualizar estado de orden:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
	}
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
export const getAllOrders = async (req: AuthRequest, res: Response) => {
	try {
		// Verificar que el usuario es admin
		if (req.user?.role !== 'admin') {
			return res.status(403).json({ message: 'No tienes permisos para ver todas las órdenes' });
		}

		const { page = 1, limit = 10, status, userId } = req.query;
		const pageNumber = parseInt(page as string);
		const limitNumber = parseInt(limit as string);

		// Construir filtros
		const filters: any = {};
		if (status) filters.status = status;
		if (userId) filters.user = userId;

		// Obtener órdenes con paginación
		const orders = await Order.find(filters)
			.populate('user', 'name email')
			.populate('items.product', 'name price images')
			.sort({ createdAt: -1 })
			.limit(limitNumber)
			.skip((pageNumber - 1) * limitNumber);

		// Contar total de órdenes
		const totalOrders = await Order.countDocuments(filters);
		const totalPages = Math.ceil(totalOrders / limitNumber);

		return res.json({
			message: 'Órdenes obtenidas exitosamente',
			orders,
			pagination: {
				currentPage: pageNumber,
				totalPages,
				totalOrders,
				hasNext: pageNumber < totalPages,
				hasPrev: pageNumber > 1
			}
		});
	} catch (error) {
		console.error('Error al obtener todas las órdenes:', error);
		return res.status(500).json({ message: 'Error interno del servidor' });
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
			Order.countDocuments({ status: OrderStatus.PROCESSING }),
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
