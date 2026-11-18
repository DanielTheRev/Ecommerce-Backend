import { Router } from 'express';
import { ShopTheLookController } from '@/controllers/shopTheLook.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';
import { imageUpload } from '@/config/multer';

const upload = imageUpload;

const router: Router = Router();

// Exigir capacidad de Combos / Bundles (Habilitado desde Plan Point para todos los rubros)
router.use(requirePlanCapability('hasProductBundles', 'Conjuntos de Productos / Combos'));

// ============================================================================
// ARCHIVADO EN CAJA / MODO SOLO LECTURA (Reemplazado por ProductBundle)
// ============================================================================
// Las rutas de mutación (creación, edición, borrado) quedan comentadas y archivadas.
// Solo se preservan las lecturas públicas (GET) para no romper vistas existentes.
// ============================================================================

// Rutas públicas (Solo lectura)
router.get('/', ShopTheLookController.getActiveLooks);
router.get('/:id', ShopTheLookController.getShopTheLook);

// --- Rutas de mutación archivadas (Chau mutaciones en ShopTheLook) ---
// router.post('/:id/engagement', ShopTheLookController.trackEngagement);
// router.post('/reset-ranking-base', protect, adminOnly, ShopTheLookController.resetAllRankingBase);
// router.post('/', protect, adminOnly, upload.any(), ShopTheLookController.createLook);
// router.put('/:id', protect, adminOnly, upload.any(), ShopTheLookController.updateLook);
// router.patch('/:id/ranking-score', protect, adminOnly, ShopTheLookController.updateRankingScore);
// router.post('/:id/ranking-score/reset', protect, adminOnly, ShopTheLookController.resetRankingScore);
// router.delete('/:id', protect, adminOnly, ShopTheLookController.deleteLook);

export default router;
