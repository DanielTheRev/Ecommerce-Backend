import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

/**
 * BORRADOR: Pendiente de integración real con Correo Argentino / Andreani.
 */
export const courierShippingAddon: AddonModule = {
	manifest: {
		id: 'courier_shipping',
		name: 'Envíos Automatizados por Correo (Borrador)',
		shortDescription: 'Cotización y etiquetas automáticas con Correo Argentino / Andreani.',
		category: 'operaciones',
		icon: 'local_post_office',
		implementationStatus: 'draft',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 7000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasAutomatedShippingCouriers'],
		requiresSetup: true,
		targets: {
			domains: ['shipping', 'checkout'],
			adminScreens: ['settings/shipping/couriers'],
			storefrontBlocks: ['checkout_courier_quote']
		}
	}
};
