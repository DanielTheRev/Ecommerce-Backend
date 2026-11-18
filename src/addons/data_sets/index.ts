import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const dataSetsAddon: AddonModule = {
	manifest: {
		id: 'data_sets',
		aliases: ['datasets'],
		name: 'Conjuntos de Datos (Colecciones Dinámicas)',
		shortDescription: 'Agrupaciones automáticas de productos por categoría, tags, precio o stock.',
		category: 'producto',
		icon: 'filter_list',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasDataSets'],
		requiresSetup: false,
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['products/datasets'],
			storefrontBlocks: ['dynamic_collection_section']
		}
	}
};
