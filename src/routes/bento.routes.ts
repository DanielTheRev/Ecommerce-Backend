import { Router } from 'express';
import { BentoController } from '@/controllers/bento.controller';
import { protect, adminOnly } from '@/middleware/auth';
import multer from 'multer';

const multerConfig = multer().fields([
  { name: 'mainBlock_imageDesktop', maxCount: 1 },
  { name: 'mainBlock_imageMobile', maxCount: 1 },
  { name: 'topRightBlock_imageDesktop', maxCount: 1 },
  { name: 'topRightBlock_imageMobile', maxCount: 1 },
  { name: 'bottomRightBlock_imageDesktop', maxCount: 1 },
  { name: 'bottomRightBlock_imageMobile', maxCount: 1 },
  { name: 'footerBlock_imageDesktop', maxCount: 1 },
  { name: 'footerBlock_imageMobile', maxCount: 1 }
]);

const router: Router = Router();

// Rutas públicas
router.get('/', BentoController.getBentoConfig);

// Rutas protegidas
router.put('/', protect, adminOnly, multerConfig, BentoController.upsertBentoConfig);

export default router;
