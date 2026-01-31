import { AppError } from '@/errors/app.error';
import {
	CreateOrderDTO,
	OrderStatus,
	PaymentStatus,
	updatePaymentStatusDTO,
	updateShippingStatusDTO
} from '@/interfaces/order.interface';
import OrderModel from '@/models/Order.model';
import { PaymentService } from './Payment.service';
import { PaymentMethodService } from './paymentMethod.service';
import { ProductService } from './product.service';
import { ShippingMethodService } from './shippingMethod.service';

import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { UalaOrderStatus } from '@/interfaces/ualaWebhook.interface';
import { Role } from '@/interfaces/user.interface';

export class OrderService {
	static async getOrderById(id: string) {
		if (!id) throw new AppError('Order ID is required', 'El ID de la orden es requerido', 400);
		try {
			const order = await OrderModel.findById(id);
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

	static async getOrderByIdPopulated(id: string) {
		try {
			const order = await OrderModel.findById(id)
				.populate('user', 'name email')
				.populate('items.product', 'name price images');
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

	static async updateOrderStatus(id: string, orderStatus: PaymentStatus) {
		try {
			const order = await OrderModel.findByIdAndUpdate(id, { orderStatus }, { new: true });
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

	static async createOrder(data: CreateOrderDTO, userId: string) {
		/* Validate user and order data */
		if (!userId)
			throw new AppError(
				'User ID is required to create an order',
				'El ID del usuario es requerido para crear una orden',
				400
			);
		if (!data || data.items.length === 0)
			throw new AppError(
				'Order items are required',
				'Los items de la orden son requeridos',
				400
			);
		const orderIDS = data.items.map((item) => item.productId);
		try {
			/* fetching products in the cart from DB */
			/* if any product is not found, throw an error */
			const items = await ProductService.getProductsByIds(orderIDS);
			/* verifying product stock*/
			await ProductService.verifyProductStockFromIds(
				data.items.map((item) => ({ _id: item.productId, quantity: item.quantity }))
			);
			/* formatting items for payment service */
			const itemsFormatted = items.map((product) => {
				const itemInTheCart = data.items.find((e) => e.productId === product._id.toString());
				return {
					data: product,
					quantity: itemInTheCart?.quantity || 0
				};
			});
			/* get shipping method */
			const shippingMethod = await ShippingMethodService.getShippingMethodById(
				data.shippingMethod._id
			);
			/* get payment method */
			const paymentMethod = await PaymentMethodService.getPaymentMethodById(
				data.paymentMethod._id
			);
			/* creating payment service instance */
			const paymentService = new PaymentService(
				itemsFormatted,
				paymentMethod.type,
				shippingMethod!.cost
			);

			const status =
				shippingMethod!.type === ShippingType.HOME_DELIVERY
					? OrderStatus.PROCESSING_SHIPPING
					: OrderStatus.PENDING;

			/* creating order in DB */
			const order = new OrderModel({
				user: userId,
				status,
				items: paymentService.getOrderProcessedItems(),
				shippingInfo: {
					type: shippingMethod!.type,
					pickupPoint: data.shippingMethod.pickupPoint,
					cost: shippingMethod!.cost
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
					throw new AppError(
						'Failed to create order',
						'Error al intentar crear la orden',
						500
					);
				}
				extras = ualaOrder;
			}
			await order.save();
			/* reducing product stock */
			await ProductService.reduceProductStock(
				data.items.map((item) => ({ _id: item.productId, quantity: item.quantity }))
			);
			// return order with populated fields
			const populatedOrder = await OrderModel.findById(order._id)
				.populate('user', 'name email')
				.populate('items.product', 'name price images');

			return { order: populatedOrder, extras };
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create order', 'Error al intentar crear la orden', 500);
		}
	}

	static async getOrdersByUserId(userId: string, query: {
		status: string;
		dateRange: string;
		page: number;
		limit: number;
	}) {
		if (!userId)
			throw new AppError(
				'User ID is required to fetch orders',
				'El ID del usuario es requerido para obtener las órdenes',
				400
			);
		try {
			const skip = (query.page - 1) * query.limit;
			const { status, dateRange, limit, page } = query
			// Construir filtros
			const filters: any = {
				user: userId
			};

			// Filtro por estado
			if (status) {
				filters.status = status;
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


			const userOrders = await OrderModel.find(filters)
				.populate({
					path: 'items.product',
					select: 'name price images description category'
				})
				.sort({ createdAt: -1 }) // Ordenar por fecha de creación descendente
				.skip(skip)
				.limit(query.limit);
			const total = await OrderModel.countDocuments(filters);

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

	static async updatePaymentStatus(data: updatePaymentStatusDTO) {
		if (!data.orderID)
			throw new AppError(
				'Order ID is required to update payment status',
				'El ID de la orden es requerido para actualizar el estado del pago',
				400
			);
		try {
			let order = await this.getOrderByIdPopulated(data.orderID);
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

	static async updateOrderShippingStatus(data: updateShippingStatusDTO) {
		if (!data.orderID)
			throw new AppError(
				'Order ID is required to update shipping status',
				'El ID de la orden es requerido para actualizar el estado del envío',
				400
			);
		try {
			const order = await OrderModel.findById(data.orderID)
				.populate('user', 'name email profilePhoto role')
				.populate({
					path: 'items.product',
					select: 'name price images description category'
				});

			if (!order) {
				throw new AppError('Order not found', 'Orden no encontrada', 404);
			}
			order.status = data.status;
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
	/* only admin */
	static async getAllOrders(
		role: Role,
		query: {
			status: string;
			userId: string;
			dateRange: string;
			page: string | number;
			limit: string | number;
		}
	) {
		if (query.userId === 'undefined')
			throw new AppError('Invalid userId filter', 'El filtro de userId no es válido', 400);

		if (role !== 'admin') {
			throw new AppError('Unauthorized access', 'Acceso no autorizado', 403);
		}
		const page = parseInt(query.page as string) || 1;
		const limit = parseInt(query.limit as string) || 10;
		const skip = (page - 1) * limit;

		// Construir filtros
		const filters: any = {};

		// Filtro por estado
		if (query.status) {
			filters.status = query.status;
		}

		// Filtro por usuario
		if (query.userId) {
			filters.user = query.userId;
		}

		// Filtro por rango de fechas
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
		try {
			// Obtener órdenes con Paginación y populate mejorado
			const orders = await OrderModel.find(filters)
				.populate('user', 'name email profilePhoto role')
				.populate({
					path: 'items.product',
					select: 'name price images description category'
				})
				.sort({ createdAt: -1 }) // Ordenar por fecha de creación descendente
				.skip(skip)
				.limit(limit);

			// Contar total de órdenes con los mismos filtros
			const total = await OrderModel.countDocuments(filters);

			// Estadísticas adicionales (opcional)
			const stats = await OrderModel.aggregate([
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

	static async cancelOrder(id: string, userID: string, role: Role) {
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
			const order = await this.getOrderById(id);
			if (!order) throw new AppError('Order not found', 'Orden no encontrada', 404);
			// verify if the user is the owner of the order or an admin if is admin can cancel the order
			if (order.user.toString() !== userID && role !== 'admin') {
				throw new AppError(
					'You can only cancel your own orders',
					'Solo puedes cancelar tus propias órdenes',
					403
				);
			}

			// only pending orders can be cancelled
			if (order.status !== OrderStatus.PENDING) {
				throw new AppError(
					'Only pending orders can be cancelled',
					'Solo se pueden cancelar órdenes pendientes',
					400
				);
			}

			// Actualizar estado a cancelado
			order.status = OrderStatus.CANCELLED;
			order.paymentInfo.status = PaymentStatus.CANCELLED;
			await order.save();

			// restore product stock
			await ProductService.restoreProductStock(order.items);
			const updatedOrder = await this.getOrderByIdPopulated(id);
			return updatedOrder;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('failed to cancel order', 'Error al intentar cancelar la orden', 500);
		}
	}

	static async getOrderStats(role: Role) {
		/* Verify role exist and its Admin */
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
				OrderModel.countDocuments(),
				OrderModel.countDocuments({ status: OrderStatus.PENDING }),
				OrderModel.countDocuments({ status: OrderStatus.PROCESSING_SHIPPING }),
				OrderModel.countDocuments({ status: OrderStatus.SHIPPED }),
				OrderModel.countDocuments({ status: OrderStatus.DELIVERED }),
				OrderModel.countDocuments({ status: OrderStatus.CANCELLED }),
				OrderModel.aggregate([
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
}
