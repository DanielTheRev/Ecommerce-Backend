import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const googleAnalyticsSettingsSchema = z.object({
	enableGa4Tracking: z.boolean().default(true),
	trackEcommerceFunnelEvents: z.boolean().default(true)
});

export const googleAnalyticsAddon: AddonModule = {
	manifest: {
		id: 'google_analytics',
		aliases: ['ga4', 'analytics_tracker'],
		name: 'Google Analytics 4 (GA4 E-Commerce)',
		shortDescription:
			'Medición de tráfico, embudo de conversión e ingresos en tiempo real con Google Analytics 4 (Measurement ID G-XXXXXXXX).',
		category: 'marketing',
		icon: 'QueryStats',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3000,
		surfaces: ['admin_module', 'tracker'],
		grantsCapabilities: ['hasExternalIntegrations'],
		requiresSetup: false,
		settingsRoute: '/home/settings?tab=marketing_pixels_and_feeds',
		settingsSchema: googleAnalyticsSettingsSchema,
		configurableLabels: [
			{
				key: 'googleAnalyticsTitle',
				label: 'Título de Google Analytics 4',
				description: 'Encabezado de la configuración de GA4.',
				defaultValue: 'Google Analytics 4 (GA4)',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableGa4Tracking',
				label: 'Habilitar medición con Google Analytics 4 (G-XXXXXXXX)',
				description: 'Inyecta la etiqueta global gtag.js con el Measurement ID del comercio.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'trackEcommerceFunnelEvents',
				label: 'Enviar eventos de E-Commerce (view_item, add_to_cart, purchase)',
				description: 'Reporta valor de carrito, moneda ARS e ítems comprados a los informes de monetización de GA4.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['storefront_prices', 'checkout'],
			adminScreens: ['marketing/google-analytics'],
			storefrontBlocks: ['ga4_tracker']
		}
	}
};
