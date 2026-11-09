import { Router } from 'express';
import { VisualMenuController } from '@/controllers/visualMenu.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';
import { imageUpload } from '@/config/multer';

const multerConfig = imageUpload.any();

const router: Router = Router();

// Rutas públicas (con x-api-key para storefronts o sesión)
router.get('/', VisualMenuController.getVisualMenu);

// Rutas protegidas (Panel de Control - Requiere Marketing Banners)
router.put('/', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Menús Visuales'), multerConfig, VisualMenuController.updateVisualMenu);
router.post('/', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Menús Visuales'), multerConfig, VisualMenuController.updateVisualMenu);

export default router;
