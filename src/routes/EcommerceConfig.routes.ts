import { Router } from 'express';
import { EcommerceConfigController } from '@/controllers/EcommerceConfig.controller';
import { protect, adminOnly } from '@/middleware/auth';

const router: Router = Router();

router.get(
  '/mercadopago/callback', EcommerceConfigController.handleMercadoPagoCallback
);

// Todas las rutas de configuración requieren autenticación de administrador
router.use(protect, adminOnly);

router.get('/mercadopago-methods', EcommerceConfigController.getMercadoPagoMethods);
router.get('/', EcommerceConfigController.getConfig);
router.post('/', EcommerceConfigController.createConfig);
router.put('/', EcommerceConfigController.updateConfig);
router.delete('/', EcommerceConfigController.deleteConfig);

export default router;
