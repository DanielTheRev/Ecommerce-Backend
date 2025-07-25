import { Router } from 'express';
import { PaymentMethodController } from '../controllers/paymentMethodController';
import { protect, adminOnly } from '../middleware/auth';

const router: Router = Router();

// Rutas públicas
router.get('/active', PaymentMethodController.getActivePaymentMethods); // Obtener métodos de pago activos
router.get('/:id', PaymentMethodController.getPaymentMethodById);       // Obtener método de pago por ID

// Rutas protegidas (solo administradores)
router.get('/', protect, adminOnly, PaymentMethodController.getAllPaymentMethods);        // Obtener todos los métodos de pago (admin)
router.post('/', protect, adminOnly, PaymentMethodController.createPaymentMethod);        // Crear método de pago
router.put('/:id', protect, adminOnly, PaymentMethodController.updatePaymentMethod);      // Actualizar método de pago
router.delete('/:id', protect, adminOnly, PaymentMethodController.deletePaymentMethod);   // Eliminar método de pago
router.patch('/:id/toggle', protect, adminOnly, PaymentMethodController.togglePaymentMethodStatus); // Activar/Desactivar método de pago

export default router;
