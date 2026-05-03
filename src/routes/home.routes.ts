import { HomeController } from '@/controllers/home.controller';
import { BannerController } from '@/controllers/banner.controller';
import { Router } from 'express';
import { protect, adminOnly } from '@/middleware/auth';
import { validateSchema } from '@/middleware/validator.middleware';
import { CreateBannerSchema, UpdateBannerSchema } from '@/schemas/banner.schema';
import multer from 'multer';

const upload = multer();

const router: Router = Router();

// Public Home Configuration
router.get('/home-config', HomeController.getHomeConfiguration);

// Admin Banner Management
router.get('/banners', protect, adminOnly, BannerController.getAllBanners);
router.post('/banners', protect, adminOnly, upload.single('image'), validateSchema(CreateBannerSchema), BannerController.createBanner);
router.get('/banners/:id', protect, adminOnly, BannerController.getBannerById);
router.put('/banners/:id', protect, adminOnly, upload.single('image'), validateSchema(UpdateBannerSchema), BannerController.updateBanner);
router.delete('/banners/:id', protect, adminOnly, BannerController.deleteBanner);

export default router;
