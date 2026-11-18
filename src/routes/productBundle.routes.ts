import { Router } from 'express';
import { ProductBundleController } from '@/controllers/productBundle.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';

const router: Router = Router();

// Exigir capacidad de Conjuntos de Productos / Combos (Habilitado desde Plan Point para arriba)
router.use(requirePlanCapability('hasProductBundles', 'Conjuntos de Productos / Combos'));

// Rutas públicas / Storefront
router.get('/', ProductBundleController.getAllBundles);
router.get('/:idOrSlug', ProductBundleController.getBundle);

// Rutas de administración
router.post('/', protect, adminOnly, ProductBundleController.createBundle);
router.put('/:id', protect, adminOnly, ProductBundleController.updateBundle);
router.delete('/:id', protect, adminOnly, ProductBundleController.deleteBundle);

export default router;
