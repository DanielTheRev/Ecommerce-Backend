import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const productBundlesAddon: AddonModule = {
	manifest: {
		id: 'product_bundles',
		aliases: ['combos'],
		name: 'Conjuntos & Combos de Productos',
		shortDescription: 'Armá combos, looks y packs promocionales con stock virtual y margen automático.',
		category: 'marketing',
		icon: 'layers',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 5500,
		surfaces: ['admin_module', 'admin_form', 'storefront_section'],
		grantsCapabilities: ['hasProductBundles'],
		requiresSetup: false,
		configurableLabels: [
			{
				key: 'bundleTitle',
				label: 'Título de combos / conjuntos',
				description: 'Encabezado de packs y combos en formulario y tienda.',
				defaultValue: 'Combos & Conjuntos',
				surface: 'admin_form'
			}
		],
		targets: {
			domains: ['product_form', 'product_pricing'],
			productFormSlots: [{ slot: 'bundles', mode: 'extend', componentKey: 'product_bundles_selector' }],
			adminScreens: ['products/bundles'],
			storefrontBlocks: ['product_bundles_cross_sell']
		}
	}
};
