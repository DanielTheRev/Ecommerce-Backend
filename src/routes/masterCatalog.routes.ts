import { Router } from 'express';
import { MasterCatalogController } from '@/controllers/masterCatalog.controller';
import { requireSuperAdmin } from '@/middleware/masterAuth.middleware';

const router: Router = Router();

// Consultas públicas / de mostrador
router.get('/lookup/:barcode', MasterCatalogController.lookupBarcode);
router.get('/search', MasterCatalogController.search);

// Siembra y mantenimiento (exclusivo para SuperAdmin / clave maestra)
router.post('/seed', requireSuperAdmin, MasterCatalogController.seed);

export default router;
