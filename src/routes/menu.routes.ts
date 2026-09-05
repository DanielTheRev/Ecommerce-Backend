import { Router } from 'express';
import { MenuController } from '@/controllers/menu.controller';
import { protect, adminOnly } from '@/middleware/auth';
import multer from 'multer';

const multerConfig = multer().any();

const router: Router = Router();

// Rutas públicas (Tienda o Panel)
router.get('/', MenuController.getMenus);
router.get('/:slugOrId', MenuController.getMenu);

// Rutas protegidas (Administración)
router.post('/', protect, adminOnly, multerConfig, MenuController.createMenu);
router.put('/:id', protect, adminOnly, multerConfig, MenuController.updateMenu);
router.delete('/:id', protect, adminOnly, MenuController.deleteMenu);

export default router;
