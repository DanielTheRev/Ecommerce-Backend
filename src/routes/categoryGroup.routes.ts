import { Router } from 'express';
import { CategoryGroupController } from '@/controllers/categoryGroup.controller';
import { protect, adminOnly } from '@/middleware/auth';

const router: Router = Router();

// Rutas públicas (Tienda o Panel)
router.get('/', CategoryGroupController.getCategoryGroups);
router.get('/raw-categories', CategoryGroupController.getDistinctRawCategories);
router.get('/:idOrSlug', CategoryGroupController.getCategoryGroup);

// Rutas protegidas (Administración)
router.post('/', protect, adminOnly, CategoryGroupController.createCategoryGroup);
router.put('/:id', protect, adminOnly, CategoryGroupController.updateCategoryGroup);
router.delete('/:id', protect, adminOnly, CategoryGroupController.deleteCategoryGroup);

export default router;
