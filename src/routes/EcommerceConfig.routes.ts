import { Router } from 'express';
import { EcommerceConfigController } from '@/controllers/EcommerceConfig.controller';
import { protect, adminOnly } from '@/middleware/auth';
import multer from 'multer';

const upload = multer();
const router: Router = Router();

router.get(
  '/mercadopago/callback', EcommerceConfigController.handleMercadoPagoCallback
);

// Ruta pública para obtener la configuración (sin claves sensibles)
router.get('/public', EcommerceConfigController.getPublicConfig);

// Todas las rutas de configuración requieren autenticación de administrador
router.use(protect, adminOnly);

router.get('/mercadopago-methods', EcommerceConfigController.getMercadoPagoMethods);
router.get('/recommendations', EcommerceConfigController.getRecommendationsConfig);
router.put('/recommendations', EcommerceConfigController.updateRecommendationsConfig);
router.get('/', EcommerceConfigController.getConfig);
router.post('/', EcommerceConfigController.createConfig);
router.put('/', EcommerceConfigController.updateConfig);
router.patch('/logo', upload.single('logo'), EcommerceConfigController.updateLogo);
router.post('/recalculate-prices', EcommerceConfigController.triggerRecalculation);
router.delete('/', EcommerceConfigController.deleteConfig);

export default router;
