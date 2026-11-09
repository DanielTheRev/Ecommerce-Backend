import { Router } from 'express';
import { CategoryGroupController } from '@/controllers/categoryGroup.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';

const router: Router = Router();

// Rutas públicas (Tienda o Panel)
router.get('/', CategoryGroupController.getCategoryGroups);
router.get('/raw-categories', CategoryGroupController.getDistinctRawCategories);
router.get('/:idOrSlug', CategoryGroupController.getCategoryGroup);

// Rutas protegidas (Administración - Requiere Catálogo Web / Point o Pro)
router.post('/', protect, adminOnly, requirePlanCapability('hasWebCatalog', 'Categorías Web del Catálogo'), CategoryGroupController.createCategoryGroup);
router.put('/:id', protect, adminOnly, requirePlanCapability('hasWebCatalog', 'Categorías Web del Catálogo'), CategoryGroupController.updateCategoryGroup);
router.delete('/:id', protect, adminOnly, requirePlanCapability('hasWebCatalog', 'Categorías Web del Catálogo'), CategoryGroupController.deleteCategoryGroup);

export default router;
