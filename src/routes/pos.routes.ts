import { Router } from 'express';
import { PosController } from '../controllers/pos.controller';
import { PointController } from '../controllers/point.controller';
import { protect, staffOnly } from '../middleware/auth';

const router: Router = Router();

// Rutas de escaneo y sincronización móvil con mostrador POS
router.post('/scan', protect, staffOnly, PosController.scanBarcode);
router.get('/pairing', protect, staffOnly, PosController.getPairingData);
router.get('/scanners', protect, staffOnly, PosController.getActiveScanners);

// Rutas de integración con Terminales de Cobro Point (Posnet físico / virtual)
router.get('/point/devices', protect, staffOnly, PointController.getDevices);
router.post('/point/order', protect, staffOnly, PointController.createOrder);
router.get('/point/order/:orderId', protect, staffOnly, PointController.getOrderStatus);
router.post('/point/order/:orderId/cancel', protect, staffOnly, PointController.cancelOrder);

export default router;
