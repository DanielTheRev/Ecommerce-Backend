import { Router } from 'express';
import { FeedController } from '@/controllers/feed.controller';
import { resolveTenant } from '@/middleware/tenant';

const router: Router = Router();

// Rutas de catálogo para Meta (Facebook / Instagram) y Google Shopping
router.get('/meta', resolveTenant, FeedController.getMetaFeed);
router.get('/meta/:tenantSlug', resolveTenant, FeedController.getMetaFeed);
router.get('/google', resolveTenant, FeedController.getMetaFeed);
router.get('/google/:tenantSlug', resolveTenant, FeedController.getMetaFeed);

export default router;
