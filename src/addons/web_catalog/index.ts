import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const webCatalogSettingsSchema = z.object({
	showStatusSelector: z.boolean().default(true),
	showFeaturedToggle: z.boolean().default(true)
});

export const webCatalogAddon: AddonModule = {
	manifest: {
		id: 'web_catalog',
		name: 'Catálogo Interactivo & Pedidos Online',
		shortDescription: 'Catálogo digital compartible por enlace, horarios, redes, destacados y retiro en tienda.',
		category: 'web_storefront',
		icon: 'storefront',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 9000,
		surfaces: ['admin_module', 'admin_form', 'storefront_section'],
		grantsCapabilities: [
			'hasWebCatalog',
			'hasOnlineOrders',
			'hasThemeTemplates',
			'hasFeaturedProducts',
			'hasStoreHoursAndStatus',
			'hasSocialLinks'
		],
		requiresSetup: false,
		settingsSchema: webCatalogSettingsSchema,
		configurableLabels: [
			{
				key: 'catalogVisibilityTitle',
				label: 'Título del bloque Catálogo Web',
				description: 'Encabezado de visibilidad y estado de publicación en el formulario.',
				defaultValue: 'Catálogo Web & Visibilidad',
				surface: 'admin_form'
			},
			{
				key: 'catalogVisibilitySubtitle',
				label: 'Subtítulo de Catálogo Web',
				description: 'Texto de ayuda del bloque de visibilidad en tienda.',
				defaultValue: 'Controlá si el producto está publicado y si se destaca en portada.',
				surface: 'admin_form'
			},
			{
				key: 'statusLabel',
				label: 'Label de Estado del Producto',
				description: 'Etiqueta del selector Publicado / Borrador / Pausado.',
				defaultValue: 'Estado del Producto',
				surface: 'admin_form'
			},
			{
				key: 'featuredLabel',
				label: 'Label de Destacar Producto',
				description: 'Etiqueta del switch para destacar en portada o novedades.',
				defaultValue: 'Destacar en Novedades',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'showStatusSelector',
				label: 'Habilitar Estado de Publicación',
				description: 'Muestra el selector Publicado / Borrador / Pausado en el formulario.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showFeaturedToggle',
				label: 'Habilitar Switch Destacado',
				description: 'Muestra el toggle para destacar el producto en portada / novedades.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form', 'checkout'],
			productFormSlots: [{ slot: 'catalog_visibility', mode: 'extend', componentKey: 'web_catalog_visibility' }],
			adminScreens: ['orders/online', 'settings/storefront', 'settings/theme'],
			storefrontBlocks: ['catalog_grid', 'whatsapp_order_checkout']
		}
	}
};
