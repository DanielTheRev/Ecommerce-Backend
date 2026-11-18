import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const customDomainSettingsSchema = z.object({
	domain: z
		.string()
		.trim()
		.toLowerCase()
		.regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Ingresá un dominio válido (ej: mitienda.com.ar)')
});

export const customDomainAddon: AddonModule = {
	manifest: {
		id: 'custom_domain',
		name: 'Dominio Propio (.com / .com.ar)',
		shortDescription: 'Conectá tu propio dominio con SSL automático para tu tienda o catálogo.',
		category: 'web_storefront',
		icon: 'language',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 6000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasCustomDomain'],
		requiresSetup: true,
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['settings/domain']
		},
		settingsRoute: '/settings/domain',
		settingsSchema: customDomainSettingsSchema
	}
};
