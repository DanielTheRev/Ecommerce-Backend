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
	updateOrderStatus,
	updatePaymentStatus
} from '../controllers/orderController';
import { adminOnly, protect } from '../middleware/auth';

const router: Router = Router();
// uala webhook
router.post('/ualabis-notification', ualaWebhook);
router.get('/ualabis-failedNotifications', getNotificationsUala);

// Rutas para usuarios autenticados
router.post('/', protect, createOrder); // Crear nueva orden
router.post('/updatePaymentStatus/:orderID', protect, updatePaymentStatus); // actualizar estado de una order desde el cliente
router.get('/my-orders', protect, getUserOrders); // Obtener órdenes del usuario
router.get('/:id', protect, getOrderById); // Obtener orden por ID
router.put('/:id/cancel', protect, cancelOrder); // Cancelar orden

// Rutas para administradores
router.get('/', protect, adminOnly, getAllOrders); // Obtener todas las órdenes (admin)
router.put('/:id/status', protect, adminOnly, updateOrderStatus); // Actualizar estado de orden (admin)
router.get('/admin/stats', protect, adminOnly, getOrderStats); // Obtener estadísticas (admin)

export default router;
