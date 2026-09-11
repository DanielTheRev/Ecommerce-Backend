import { Router } from 'express';
import { PosController } from '../controllers/pos.controller';
import { protect, staffOnly } from '../middleware/auth';

const router: Router = Router();

// Rutas protegidas para personal de mostrador / cajas (admin o empleado)
router.post('/scan', protect, staffOnly, PosController.scanBarcode);
router.get('/pairing', protect, staffOnly, PosController.getPairingData);
router.get('/scanners', protect, staffOnly, PosController.getActiveScanners);

export default router;
