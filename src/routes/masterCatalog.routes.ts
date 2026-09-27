import { Router } from 'express';
import { MasterCatalogController } from '@/controllers/masterCatalog.controller';

const router: Router = Router();

// Consultas públicas / de mostrador
router.get('/lookup/:barcode', MasterCatalogController.lookupBarcode);
router.get('/search', MasterCatalogController.search);

// Siembra y mantenimiento (puede ejecutarse en setup o inicialización)
router.post('/seed', MasterCatalogController.seed);

export default router;
