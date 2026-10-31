import { Router } from 'express';
import { ShopTheLookController } from '@/controllers/shopTheLook.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { imageUpload } from '@/config/multer';

const upload = imageUpload;

const router: Router = Router();

// Rutas públicas
router.get('/', ShopTheLookController.getActiveLooks);
router.get('/:id', ShopTheLookController.getShopTheLook);
router.post('/:id/engagement', ShopTheLookController.trackEngagement);

// Rutas protegidas
router.post('/reset-ranking-base', protect, adminOnly, ShopTheLookController.resetAllRankingBase);
router.post('/', protect, adminOnly, upload.any(), ShopTheLookController.createLook);
router.put('/:id', protect, adminOnly, upload.any(), ShopTheLookController.updateLook);
router.patch('/:id/ranking-score', protect, adminOnly, ShopTheLookController.updateRankingScore);
router.post('/:id/ranking-score/reset', protect, adminOnly, ShopTheLookController.resetRankingScore);
router.delete('/:id', protect, adminOnly, ShopTheLookController.deleteLook);

export default router;
