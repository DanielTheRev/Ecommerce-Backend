import { Router } from 'express';
import { VisualMenuController } from '@/controllers/visualMenu.controller';
import { protect, adminOnly } from '@/middleware/auth';
import multer from 'multer';

const multerConfig = multer().any();

const router: Router = Router();

// Rutas públicas (con x-api-key para storefronts o sesión)
router.get('/', VisualMenuController.getVisualMenu);

// Rutas protegidas (Panel de Control)
router.put('/', protect, adminOnly, multerConfig, VisualMenuController.updateVisualMenu);
router.post('/', protect, adminOnly, multerConfig, VisualMenuController.updateVisualMenu);

export default router;
