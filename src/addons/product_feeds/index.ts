import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const productFeedsAddon: AddonModule = {
	manifest: {
		id: 'product_feeds',
		name: 'Feeds Meta & Google Shopping',
		shortDescription: 'Generación automática de catálogos XML/JSON para pauta en Instagram, Facebook y Google.',
		category: 'tracking',
		icon: 'rss_feed',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4500,
		surfaces: ['admin_module', 'tracker'],
		grantsCapabilities: ['hasProductFeeds'],
		requiresSetup: false,
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['marketing/product-feeds']
		}
	}
};
