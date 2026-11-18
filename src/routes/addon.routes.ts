import { Router } from 'express';
import { AddonController } from '@/controllers/addon.controller';
import { protect, adminOnly } from '@/middleware/auth';
import priceBuilderRoutes from '@/addons/price_builder/priceBuilder.routes';
import mediaStudioRoutes from '@/addons/media_studio/mediaStudio.routes';
import detailsBuilderRoutes from '@/addons/tech_specs/detailsBuilder.routes';
import sizeGuideRoutes from '@/addons/size_guide/sizeGuide.routes';
import storefrontTemplatesRoutes from '@/addons/storefront_templates/storefrontTemplates.routes';
import marketplaceRoutes from '@/addons/marketplace/marketplace.routes';

const router: Router = Router();

router.use('/price-builder', priceBuilderRoutes);
router.use('/media-studio', mediaStudioRoutes);
router.use('/details-builder', detailsBuilderRoutes);
router.use('/size-guide', sizeGuideRoutes);
router.use('/storefront-templates', storefrontTemplatesRoutes);
router.use('/marketplace', marketplaceRoutes);
router.get('/catalog', protect, AddonController.getTenantCatalog);
router.put('/:addonId/settings', protect, adminOnly, AddonController.updateAddonSettings);

export default router;
