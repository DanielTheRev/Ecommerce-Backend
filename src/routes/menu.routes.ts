import { Router } from 'express';
import { MenuController } from '@/controllers/menu.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';
import { imageUpload } from '@/config/multer';

const multerConfig = imageUpload.any();

const router: Router = Router();

// Rutas públicas (Tienda o Panel)
router.get('/', MenuController.getMenus);
router.get('/:slugOrId', MenuController.getMenu);

// Rutas protegidas (Administración - Requiere Marketing Banners / Menús Visuales)
router.post('/', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Menús Visuales / Bento'), multerConfig, MenuController.createMenu);
router.put('/:id', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Menús Visuales / Bento'), multerConfig, MenuController.updateMenu);
router.delete('/:id', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Menús Visuales / Bento'), MenuController.deleteMenu);

export default router;
