import { Router } from 'express';
import { EcommerceConfigController } from '@/controllers/EcommerceConfig.controller';
import { protect, adminOnly, staffOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';
import { imageUpload } from '@/config/multer';

const upload = imageUpload;
const router: Router = Router();

router.get(
  '/mercadopago/callback', EcommerceConfigController.handleMercadoPagoCallback
);

// Ruta pública para obtener la configuración (sin claves sensibles)
router.get('/public', EcommerceConfigController.getPublicConfig);

// A partir de aquí todas las rutas requieren sesión autenticada
router.use(protect);

// Rutas de lectura accesibles por el personal (Admin y Empleados)
router.get('/', staffOnly, EcommerceConfigController.getConfig);
router.get('/dolares', staffOnly, EcommerceConfigController.getDolares);
router.get('/recommendations', staffOnly, EcommerceConfigController.getRecommendationsConfig);
router.get('/catalog-ranking', staffOnly, EcommerceConfigController.getCatalogRankingConfig);

// Rutas sensibles de configuración y conexión (Solo Administrador)
router.get('/mercadopago/auth-url', adminOnly, EcommerceConfigController.getMercadoPagoAuthUrl);
router.get('/mercadopago-methods', adminOnly, EcommerceConfigController.getMercadoPagoMethods);
router.get('/connection', adminOnly, EcommerceConfigController.getConnectionSettings);
router.post('/connection/regenerate-key', adminOnly, EcommerceConfigController.regenerateApiKey);
router.put('/connection/allowed-origins', adminOnly, EcommerceConfigController.updateAllowedOrigins);

// Mutaciones de configuración (Solo Administrador)
router.put('/recommendations', adminOnly, EcommerceConfigController.updateRecommendationsConfig);
router.put('/catalog-ranking', adminOnly, requirePlanCapability('hasFullWebStore', 'Ranking ELO'), EcommerceConfigController.updateCatalogRankingConfig);
router.post('/catalog-ranking/recalculate', adminOnly, requirePlanCapability('hasFullWebStore', 'Ranking ELO'), EcommerceConfigController.recalculateRankingScores);
router.post('/catalog-ranking/reset-base', adminOnly, requirePlanCapability('hasFullWebStore', 'Ranking ELO'), EcommerceConfigController.resetRankingBaseScores);
router.post('/', adminOnly, EcommerceConfigController.createConfig);
router.put('/', adminOnly, EcommerceConfigController.updateConfig);
router.patch('/logo', adminOnly, upload.single('logo'), EcommerceConfigController.updateLogo);
router.post('/recalculate-preview', adminOnly, EcommerceConfigController.previewRecalculation);
router.post('/recalculate-prices', adminOnly, EcommerceConfigController.triggerRecalculation);
router.post('/test-email', adminOnly, requirePlanCapability('hasFullWebStore', 'Emails Transaccionales'), EcommerceConfigController.sendTestEmail);
router.delete('/', adminOnly, EcommerceConfigController.deleteConfig);

export default router;
