import { Router } from 'express';
import { NewsletterController } from '../controllers/newsletter.controller';
import { protect, adminOnly } from '../middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';

const router: Router = Router();

// Exigir capacidad de Tienda Web Completa para el módulo de newsletter
router.use(requirePlanCapability('hasFullWebStore', 'Newsletter'));

// Endpoint público para suscribirse al newsletter
router.post('/subscribe', NewsletterController.subscribe);

// Endpoints de administración para ver y gestionar suscriptores
router.get('/', protect, adminOnly, NewsletterController.getAllSubscribers);
router.delete('/:id', protect, adminOnly, NewsletterController.deleteSubscriber);

export default router;
