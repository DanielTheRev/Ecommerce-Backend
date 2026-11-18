import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const ecommerceWebSettingsSchema = z.object({
	showSeoFields: z.boolean().default(true),
	showMetaImage: z.boolean().default(true)
});

export const ecommerceWebAddon: AddonModule = {
	manifest: {
		id: 'ecommerce_web',
		name: 'Tienda Web Completa & Pasarelas Online',
		shortDescription: 'Tienda ecommerce completa con checkout online (Mercado Pago/Getnet).',
		category: 'web_storefront',
		icon: 'shopping_bag',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 18000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: [
			'hasFullWebStore',
			'hasOnlinePaymentGateways'
		],
		requiresSetup: false,
		settingsSchema: ecommerceWebSettingsSchema,
		configurableLabels: [
			{
				key: 'seoTitle',
				label: 'Título del bloque SEO',
				description: 'Encabezado de metadatos para buscadores y redes sociales.',
				defaultValue: 'SEO & Metadatos',
				surface: 'admin_form'
			},
			{
				key: 'seoSubtitle',
				label: 'Subtítulo del bloque SEO',
				description: 'Texto de ayuda debajo del título de SEO.',
				defaultValue: 'Optimizá cómo aparece el producto en Google y WhatsApp.',
				surface: 'admin_form'
			},
			{
				key: 'metaTitleLabel',
				label: 'Label de Meta Título',
				description: 'Etiqueta del campo Meta Title.',
				defaultValue: 'Meta Título (SEO)',
				surface: 'admin_form'
			},
			{
				key: 'metaDescriptionLabel',
				label: 'Label de Meta Descripción',
				description: 'Etiqueta del campo Meta Description.',
				defaultValue: 'Meta Descripción (SEO)',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'showSeoFields',
				label: 'Habilitar Campos SEO en Producto',
				description: 'Muestra Meta Título y Meta Descripción en el formulario.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showMetaImage',
				label: 'Habilitar Imagen OG / SEO',
				description: 'Muestra el selector de imagen OpenGraph para compartir enlaces.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form', 'checkout', 'storefront_prices'],
			productFormSlots: [{ slot: 'seo', mode: 'extend', componentKey: 'product_seo_fields' }],
			adminScreens: ['settings/payments', 'orders/online', 'settings/theme'],
			storefrontBlocks: ['full_web_store', 'online_payment_checkout'],
			interactions: [
				{ target: 'price_builder', behavior: 'Provee la pasarela web activa (defaultWebGateway) para calcular precios y cuotas web.' }
			]
		}
	}
};
