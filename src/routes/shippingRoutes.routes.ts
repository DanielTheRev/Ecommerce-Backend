import { Router } from 'express';
import { ShippingController } from '../controllers/shipping.controller';
import { protect, adminOnly } from '../middleware/auth';
import { validateSchema } from '@/middleware/validator.middleware';
import { CreateShippingOptionSchema, UpdateShippingOptionSchema } from '@/schemas/shipping.schema';

const router: Router = Router();

// Rutas públicas
router.get('/', ShippingController.getAllShippingOptions);
// router.get('/by-payment-method', ShippingController.getShippingOptionsByPaymentMethod);

// Rutas protegidas (solo administradores)
router.get('/all', protect, adminOnly, ShippingController.getAdminShippingOptions);
router.get('/:id', protect, adminOnly, ShippingController.getShippingOptionById);
router.post('/', protect, adminOnly, validateSchema(CreateShippingOptionSchema), ShippingController.createShippingOption);
router.put('/:id', protect, adminOnly, validateSchema(UpdateShippingOptionSchema), ShippingController.updateShippingOption);
router.delete('/:id', protect, adminOnly, ShippingController.deleteShippingOption);

export default router;
