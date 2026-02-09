import { Router } from 'express';
import { PaymentMethodController } from '../controllers/paymentMethod.controller';
import { protect, adminOnly } from '../middleware/auth';
import { validateSchema } from '@/middleware/validator.middleware';
import { createPaymentSchema, updatePaymentSchema } from '@/schemas/payment,schema';

const router: Router = Router();

// Rutas públicas
router.get('/active', PaymentMethodController.getActivePaymentMethods); // Obtener métodos de pago activos
router.get('/:id', PaymentMethodController.getPaymentMethodById);       // Obtener método de pago por ID

// Rutas protegidas (solo administradores)
router.get('/', protect, adminOnly, PaymentMethodController.getAllPaymentMethods);        // Obtener todos los métodos de pago (admin)
router.post('/', protect, adminOnly, validateSchema(createPaymentSchema), PaymentMethodController.createPaymentMethod);        // Crear método de pago
router.put('/:id', protect, adminOnly, validateSchema(updatePaymentSchema), PaymentMethodController.updatePaymentMethod);      // Actualizar método de pago
router.delete('/:id', protect, adminOnly, PaymentMethodController.deletePaymentMethod);   // Eliminar método de pago

export default router;
