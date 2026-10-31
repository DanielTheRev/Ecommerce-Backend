import { Router } from 'express';
import { BentoController } from '@/controllers/bento.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { imageUpload } from '@/config/multer';

const multerConfig = imageUpload.any();

const router: Router = Router();

// Rutas públicas
router.get('/', BentoController.getBentoConfig);

// Rutas protegidas
router.put('/', protect, adminOnly, multerConfig, BentoController.upsertBentoConfig);

export default router;
