import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const storefrontTemplatesSettingsSchema = z.object({
	allowMerchantThemeCustomization: z.boolean().default(true)
});

export const storefrontTemplatesAddon: AddonModule = {
	manifest: {
		id: 'storefront_templates',
		aliases: ['theme_templates', 'store_templates'],
		name: 'Tienda de Plantillas & Diseño Web',
		shortDescription:
			'Selector de plantillas mobile-first y tiendas web completas con personalización visual y conexión de subdominio o dominio propio.',
		category: 'web_storefront',
		icon: 'palette',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 5000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasThemeTemplates'],
		requiresSetup: false,
		settingsRoute: '/home/settings?tab=storefront_and_connection',
		settingsSchema: storefrontTemplatesSettingsSchema,
		configurableSettings: [
			{
				key: 'allowMerchantThemeCustomization',
				label: 'Permitir al comerciante personalizar variables de plantilla',
				description: 'Habilita la edición de textos de portada, proporción de tarjetas y opciones visuales de la plantilla activa.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['storefront_prices', 'checkout'],
			adminScreens: ['settings/theme', 'settings/domain'],
			storefrontBlocks: ['theme_renderer']
		}
	}
};
