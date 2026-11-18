import { AddonModule } from '../addon.types';

export const masterCatalogAddon: AddonModule = {
	manifest: {
		id: 'master_catalog',
		name: 'Catálogo Maestro & Autocompletado EAN',
		shortDescription: 'Autocompletado de productos por código de barras EAN y búsqueda global para carga rápida.',
		category: 'producto',
		icon: 'qr_code_scanner',
		implementationStatus: 'ready',
		includedInPlans: [],
		isPurchasable: true,
		monthlyPriceARS: 5000,
		surfaces: ['admin_form'],
		grantsCapabilities: [],
		requiresSetup: false,
		targets: {
			domains: ['product_form', 'inventory'],
			productFormSlots: [{ slot: 'scanner_lookup', mode: 'extend', componentKey: 'ean_master_lookup' }]
		}
	}
};
