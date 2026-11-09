import { Router } from 'express';
import { HeroController } from '../controllers/hero.controller';
import { imageUpload } from '@/config/multer';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';

const multerConfig = imageUpload.fields([
  { name: 'imageDesktop1', maxCount: 1 },
  { name: 'imageDesktop2', maxCount: 1 },
  { name: 'imageMobile1', maxCount: 1 },
  { name: 'imageMobile2', maxCount: 1 }
]);

const router: Router = Router();

router.get('/', HeroController.getAll);
router.get('/:id', HeroController.getById);

// Mutaciones protegidas por rol de administración y capacidad de plan (Marketing Banners)
router.post('/', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Hero Sliders'), multerConfig, HeroController.create);
router.put('/:id', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Hero Sliders'), multerConfig, HeroController.update);
router.delete('/:id', protect, adminOnly, requirePlanCapability('hasMarketingBanners', 'Hero Sliders'), HeroController.delete);

export default router;
