import { Router } from 'express';
import { NewsletterController } from '../controllers/newsletter.controller';
import { protect, adminOnly } from '../middleware/auth';

const router: Router = Router();

// Endpoint público para suscribirse al newsletter
router.post('/subscribe', NewsletterController.subscribe);

// Endpoints de administración para ver y gestionar suscriptores
router.get('/', protect, adminOnly, NewsletterController.getAllSubscribers);
router.delete('/:id', protect, adminOnly, NewsletterController.deleteSubscriber);

export default router;
