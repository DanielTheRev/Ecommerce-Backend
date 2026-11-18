import { Router } from 'express';
import { MasterCatalogController } from '@/controllers/masterCatalog.controller';
import { requireSuperAdmin } from '@/middleware/masterAuth.middleware';
import { resolveTenant } from '@/middleware/tenant';
import { protect } from '@/middleware/auth';
import { requireAddon } from '@/middleware/addonGuard';

const router: Router = Router();

// Consultas globales protegidas por tenant + add-on 'master_catalog'
router.get('/lookup/:barcode', resolveTenant, protect, requireAddon('master_catalog', 'Catálogo Maestro Global'), MasterCatalogController.lookupBarcode);
router.get('/search', resolveTenant, protect, requireAddon('master_catalog', 'Catálogo Maestro Global'), MasterCatalogController.search);

// Siembra y mantenimiento (exclusivo para SuperAdmin / clave maestra)
router.post('/seed', requireSuperAdmin, MasterCatalogController.seed);

export default router;
