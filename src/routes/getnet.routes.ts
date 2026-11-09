import { Router } from 'express';
import { GetnetController } from '../controllers/getnet.controller';
import { optionalAuth } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';

const router: Router = Router();

// Endpoint para crear sesión de pago (Web Checkout - Exclusivo Pro)
router.post('/checkout-session', requirePlanCapability('hasOnlinePaymentGateways', 'Pasarelas de Pago Online'), optionalAuth, (req: any, res: any, next: any) => {
	GetnetController.createCheckoutSession(req, res).catch(next);
});

// Webhook para recibir notificaciones desde Getnet
router.post('/webhook/:tenantSlug', (req: any, res: any, next: any) => {
	GetnetController.handleWebhook(req, res).catch(next);
});
router.post('/webhook', (req: any, res: any, next: any) => {
	GetnetController.handleWebhook(req, res).catch(next);
});

export { router as getnetRoutes };
export default router;

