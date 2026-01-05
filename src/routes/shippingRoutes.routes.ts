import { Router } from 'express';
import { ShippingController } from '../controllers/shipping.controller';
import { protect, adminOnly } from '../middleware/auth';

const router: Router = Router();

// Rutas públicas
router.get('/', ShippingController.getAllShippingOptions);
router.get('/by-payment-method', ShippingController.getShippingOptionsByPaymentMethod);

// Rutas protegidas (solo administradores)
router.post('/', protect, adminOnly, ShippingController.createShippingOption);
router.put('/:id', protect, adminOnly, ShippingController.updateShippingOption);
router.delete('/:id', protect, adminOnly, ShippingController.deleteShippingOption);

export default router;
