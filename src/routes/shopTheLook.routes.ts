import { Router } from 'express';
import { ShopTheLookController } from '@/controllers/shopTheLook.controller';
import { protect, adminOnly } from '@/middleware/auth';
import multer from 'multer';

const upload = multer();

const router: Router = Router();

// Rutas públicas
router.get('/', ShopTheLookController.getActiveLooks);
router.get('/:id', ShopTheLookController.getShopTheLook);
router.post('/:id/engagement', ShopTheLookController.trackEngagement);

// Rutas protegidas
router.post('/', protect, adminOnly, upload.any(), ShopTheLookController.createLook);
router.put('/:id', protect, adminOnly, upload.any(), ShopTheLookController.updateLook);
router.patch('/:id/ranking-score', protect, adminOnly, ShopTheLookController.updateRankingScore);
router.delete('/:id', protect, adminOnly, ShopTheLookController.deleteLook);

export default router;
