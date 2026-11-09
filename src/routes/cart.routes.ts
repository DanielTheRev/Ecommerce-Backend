import { CartController } from '../controllers/cart.controller';
import { protect } from '../middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';
import { Router } from 'express';

const router: Router = Router();

router.use(protect);
router.use(requirePlanCapability('hasFullWebStore', 'Carrito de Tienda Web'));

router.get('/', CartController.getCart);
router.put('/', CartController.updateCart);
router.post('/merge', CartController.mergeCart);
router.delete('/', CartController.clearCart);

export default router;
