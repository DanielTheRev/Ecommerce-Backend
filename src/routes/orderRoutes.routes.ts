import { Router } from 'express';
import {
	cancelOrder,
	createOrder,
	getAllOrders,
	getNotificationsUala,
	getOrderById,
	getOrderStats,
	getUserOrders,
	ualaWebhook,
	updatePaymentStatus,
	updateShippingStatus
} from '../controllers/order.controller';
import { adminOnly, protect } from '../middleware/auth';

const router: Router = Router();
// uala webhook
router.post('/ualabis-notification', ualaWebhook);
router.get('/ualabis-failedNotifications', getNotificationsUala);

// Rutas para usuarios autenticados
router.post('/', protect, createOrder); // Crear nueva orden
router.get('/my-orders', protect, getUserOrders); // Obtener órdenes del usuario
router.get('/:id', protect, getOrderById); // Obtener orden por ID
router.put('/:id/cancel', protect, cancelOrder); // Cancelar orden

// Rutas para administradores
router.get('/', protect, adminOnly, getAllOrders); // Obtener todas las órdenes (admin)
router.post('/updatePaymentStatus', protect, adminOnly, updatePaymentStatus); // actualizar estado de una order desde el cliente
router.post('/updateShippingStatus', protect, adminOnly, updateShippingStatus); // actualizar estado de una order desde el cliente
router.get('/admin/stats', protect, adminOnly, getOrderStats); // Obtener estadísticas (admin)

export default router;
