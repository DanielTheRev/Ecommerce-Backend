import { Router } from 'express';
import { FeedController } from '@/controllers/feed.controller';
import { resolveTenant } from '@/middleware/tenant';
import { requirePlanCapability } from '@/middleware/planGuard';

const router: Router = Router();

// Rutas de catálogo para Meta (Facebook / Instagram) y Google Shopping (Exclusivo Pro)
router.get('/meta', resolveTenant, requirePlanCapability('hasProductFeeds', 'Feeds de Productos'), FeedController.getMetaFeed);
router.get('/meta/:tenantSlug', resolveTenant, requirePlanCapability('hasProductFeeds', 'Feeds de Productos'), FeedController.getMetaFeed);
router.get('/google', resolveTenant, requirePlanCapability('hasProductFeeds', 'Feeds de Productos'), FeedController.getMetaFeed);
router.get('/google/:tenantSlug', resolveTenant, requirePlanCapability('hasProductFeeds', 'Feeds de Productos'), FeedController.getMetaFeed);

export default router;
