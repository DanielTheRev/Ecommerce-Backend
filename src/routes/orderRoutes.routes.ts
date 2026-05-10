import { Router } from 'express';
import {
	cancelOrder,
	createOrder,
	payOrder,
	getAllOrders,
	getNotificationsUala,
	getOrderById,
	getOrderByIdAdmin,
	getOrderStats,
	getUserOrders,
	mercadopagoWebhook,
	ualaWebhook,
	updatePaymentStatus,
	updateShippingStatus,
	createLocalOrder,
	getDailyStats,
	getSalesStats,
	getTicket,
	trackOrder
} from '../controllers/order.controller';
import { adminOnly, optionalAuth, protect } from '../middleware/auth';
import { validateSchema } from '@/middleware/validator.middleware';
import { CreateOrderSchema, PayOrderSchema, UpdatePaymentStatusSchema, UpdateShippingStatusSchema, TrackOrderSchema } from '@/schemas/order.schema';

const router: Router = Router();
// webhooks
router.post('/mercadopago-notification', mercadopagoWebhook);
router.post('/mercadopago-notification/:tenantSlug', mercadopagoWebhook); // Nueva ruta para webhooks personalizados
router.post('/ualabis-notification', ualaWebhook);
router.get('/ualabis-failedNotifications', getNotificationsUala);

// Rutas para usuarios autenticados
router.post('/', optionalAuth, validateSchema(CreateOrderSchema), createOrder); // Crear nueva orden
router.post('/:id/pay', optionalAuth, validateSchema(PayOrderSchema), payOrder); // Intentar pagar una orden existente (reintentable)
router.get('/my-orders', protect, getUserOrders); // Obtener órdenes del usuario
router.get('/track', validateSchema(TrackOrderSchema), trackOrder); // Rastreo de orden para invitados
router.get('/:id', protect, getOrderById); // Obtener orden por ID
router.put('/:id/cancel', protect, cancelOrder); // Cancelar orden

// Rutas para administradores
router.get('/', protect, adminOnly, getAllOrders); // Obtener todas las órdenes (admin)
router.get('/admin/order/:id', protect, adminOnly, getOrderByIdAdmin); // Obtener orden por ID (admin)
router.post('/updatePaymentStatus', protect, adminOnly, validateSchema(UpdatePaymentStatusSchema), updatePaymentStatus); // actualizar estado de una order desde el cliente
router.post('/updateShippingStatus', protect, adminOnly, validateSchema(UpdateShippingStatusSchema), updateShippingStatus); // actualizar estado de una order desde el cliente
router.get('/admin/stats', protect, adminOnly, getOrderStats); // Obtener estadísticas (admin)
router.get('/admin/daily-stats', protect, adminOnly, getDailyStats); // Obtener estadísticas diarias (admin)
router.get('/admin/sales-stats', protect, adminOnly, getSalesStats); // Obtener estadísticas de ventas por rango (admin)
router.post('/admin/local-sale', protect, adminOnly, createLocalOrder); // Crear venta local (admin/employee)
router.get('/:id/ticket', protect, getTicket); // Obtener ticket PDF de venta

export default router;
