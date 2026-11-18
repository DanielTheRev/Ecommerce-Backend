import { Router } from 'express';
import { DataSetController } from '@/controllers/dataSet.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';

const router: Router = Router();

// Exigir capacidad de Conjuntos de Datos (Habilitado desde Plan Point para arriba)
router.use(requirePlanCapability('hasDataSets', 'Conjuntos de Datos'));

// Rutas públicas / Storefront
router.get('/', DataSetController.getAllDataSets);
router.get('/:idOrSlug', DataSetController.getDataSet);
router.get('/:idOrSlug/execute', DataSetController.executeDataSet);

// Rutas de administración
router.post('/', protect, adminOnly, DataSetController.createDataSet);
router.put('/:id', protect, adminOnly, DataSetController.updateDataSet);
router.delete('/:id', protect, adminOnly, DataSetController.deleteDataSet);

export default router;
