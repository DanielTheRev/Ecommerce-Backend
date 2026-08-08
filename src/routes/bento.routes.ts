import { Router } from 'express';
import { BentoController } from '@/controllers/bento.controller';
import { protect, adminOnly } from '@/middleware/auth';
import multer from 'multer';

const multerConfig = multer().any();

const router: Router = Router();

// Rutas públicas
router.get('/', BentoController.getBentoConfig);

// Rutas protegidas
router.put('/', protect, adminOnly, multerConfig, BentoController.upsertBentoConfig);

export default router;
