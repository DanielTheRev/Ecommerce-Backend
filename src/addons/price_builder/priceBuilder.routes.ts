import { Router } from 'express';
import { protect, staffOnly } from '@/middleware/auth';
import { requireAddon } from '@/middleware/addonGuard';
import { PriceBuilderController } from './priceBuilder.controller';

const router: Router = Router();

router.use(protect, requireAddon('price_builder', 'Price Builder — Creador de Precios'));

router.get('/presets', staffOnly, PriceBuilderController.getPresets);
router.post('/calculate', staffOnly, PriceBuilderController.calculatePreview);

export default router;
