import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const localDeliveryAddon: AddonModule = {
	manifest: {
		id: 'local_delivery',
		name: 'Envíos Locales & Cadetería Propia',
		shortDescription: 'Cálculo de envío local por zonas o cadetería propia para pedidos online.',
		category: 'operaciones',
		icon: 'two_wheeler',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasLocalDeliveryAndTakeaway'],
		requiresSetup: false,
		targets: {
			domains: ['shipping', 'checkout'],
			adminScreens: ['settings/shipping'],
			storefrontBlocks: ['checkout_local_delivery']
		}
	}
};
