import express, { Router } from 'express';
import {
	createOrder,
	getUserOrders,
	getOrderById,
	updateOrderStatus,
	cancelOrder,
	getAllOrders,
	getOrderStats
} from '../controllers/orderController';
import { protect, adminOnly } from '../middleware/auth';

const router: Router = Router();

// Rutas para usuarios autenticados
router.post('/', protect, createOrder); // Crear nueva orden
router.get('/my-orders', protect, getUserOrders); // Obtener órdenes del usuario
router.get('/:id', protect, getOrderById); // Obtener orden por ID
router.put('/:id/cancel', protect, cancelOrder); // Cancelar orden

// Rutas para administradores
router.get('/', protect, adminOnly, getAllOrders); // Obtener todas las órdenes (admin)
router.put('/:id/status', protect, adminOnly, updateOrderStatus); // Actualizar estado de orden (admin)
router.get('/admin/stats', protect, adminOnly, getOrderStats); // Obtener estadísticas (admin)

export default router;
