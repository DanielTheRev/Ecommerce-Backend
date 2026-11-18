import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const metaMarketingSettingsSchema = z.object({
	enableMetaPixel: z.boolean().default(true),
	enableConversionsApiCapi: z.boolean().default(true),
	enableCatalogFeedUrl: z.boolean().default(true),
	enableGoogleMerchantFeedUrl: z.boolean().default(true)
});

export const metaMarketingAddon: AddonModule = {
	manifest: {
		id: 'meta_marketing',
		aliases: ['meta_pixel', 'product_feeds', 'facebook_catalog', 'external_integrations', 'integrations'],
		name: 'Meta Pixel, CAPI & Catálogo Shopping (Feeds)',
		shortDescription:
			'Píxel de Meta + Conversions API (CAPI server-side) y URLs de Feeds XML/JSON en vivo para sincronizar productos con el Marketplace de Meta (Instagram/Facebook Shop) y Google Shopping.',
		category: 'marketing',
		icon: 'campaign',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 5000,
		surfaces: ['admin_module', 'tracker'],
		grantsCapabilities: ['hasProductFeeds', 'hasExternalIntegrations'],
		requiresSetup: false,
		settingsRoute: '/home/settings?tab=marketing_pixels_and_feeds',
		settingsSchema: metaMarketingSettingsSchema,
		configurableLabels: [
			{
				key: 'metaMarketingTitle',
				label: 'Título de Meta Pixel & Catálogo Shopping',
				description: 'Encabezado de la pantalla de configuración de Meta Ads y Feeds de productos.',
				defaultValue: 'Meta Pixel, CAPI & Catálogo Shopping',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableMetaPixel',
				label: 'Habilitar Meta Pixel ID en Tienda',
				description: 'Inyecta el Pixel de Meta en el storefront para medir PageView, ViewContent, AddToCart y Purchase.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableConversionsApiCapi',
				label: 'Habilitar Meta Conversions API (CAPI Server-Side)',
				description: 'Envía eventos de compra desde el servidor usando el Access Token y Test Event Code para no perder atribución por bloqueadores.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableCatalogFeedUrl',
				label: 'Exponer URL de Feed para Catálogo de Meta (/api/feeds/facebook.xml)',
				description: 'Genera la URL pública auto-actualizable para importar todos los productos en Meta Commerce Manager / Instagram Shopping.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableGoogleMerchantFeedUrl',
				label: 'Exponer URL de Feed para Google Merchant Center (/api/feeds/google.xml)',
				description: 'Genera el feed compatible con Google Shopping.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['storefront_prices', 'checkout'],
			adminScreens: ['marketing/meta-shopping', 'marketing/product-feeds'],
			storefrontBlocks: ['meta_pixel_tracker']
		}
	}
};
