import { Router } from 'express';
import { VisualMenuController } from '@/controllers/visualMenu.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { imageUpload } from '@/config/multer';

const multerConfig = imageUpload.any();

const router: Router = Router();

// Rutas públicas (con x-api-key para storefronts o sesión)
router.get('/', VisualMenuController.getVisualMenu);

// Rutas protegidas (Panel de Control)
router.put('/', protect, adminOnly, multerConfig, VisualMenuController.updateVisualMenu);
router.post('/', protect, adminOnly, multerConfig, VisualMenuController.updateVisualMenu);

export default router;
