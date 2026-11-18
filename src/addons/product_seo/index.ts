import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const productSeoSettingsSchema = z.object({
	showSeoFields: z.boolean().default(true),
	showMetaImage: z.boolean().default(true),
	showSlugEditor: z.boolean().default(true),
	enableJsonLd: z.boolean().default(true)
});

export const productSeoAddon: AddonModule = {
	manifest: {
		id: 'product_seo',
		aliases: ['seo_pro'],
		name: 'SEO, Open Graph & JSON-LD',
		shortDescription:
			'Metadatos para Google (SERP), tarjetas Open Graph 1200×630 para WhatsApp/Instagram y JSON-LD automático (schema.org/Product).',
		category: 'web_storefront',
		icon: 'travel_explore',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_form', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		settingsSchema: productSeoSettingsSchema,
		configurableLabels: [
			{
				key: 'seoTitle',
				label: 'Título del bloque SEO',
				description: 'Encabezado principal del bloque SEO & Open Graph en el formulario.',
				defaultValue: 'SEO & Metadatos',
				surface: 'admin_form'
			},
			{
				key: 'seoSubtitle',
				label: 'Subtítulo del bloque SEO',
				description: 'Texto guía debajo del título del bloque SEO.',
				defaultValue: 'Optimizá cómo se ve tu producto en Google, WhatsApp y redes sociales.',
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
			},
			{
				key: 'slugLabel',
				label: 'Label de URL Amigable (Slug)',
				description: 'Etiqueta del campo editable de URL del producto.',
				defaultValue: 'URL Amigable (Slug)',
				surface: 'admin_form'
			},
			{
				key: 'metaImageLabel',
				label: 'Label de Imagen Open Graph',
				description: 'Etiqueta del selector de imagen 1200×630 para compartir enlaces.',
				defaultValue: 'Imagen para WhatsApp & Redes (1200×630)',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'showSeoFields',
				label: 'Habilitar Campos SEO (Meta Title / Description)',
				description: 'Muestra Meta Título, Meta Descripción y vista previa SERP en el formulario.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showMetaImage',
				label: 'Habilitar Imagen OG 1200×630',
				description: 'Muestra el selector de imagen Open Graph optimizada para WhatsApp e Instagram.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showSlugEditor',
				label: 'Permitir editar URL (Slug)',
				description: 'Habilita el campo de slug editable en el formulario de producto.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableJsonLd',
				label: 'Generar JSON-LD automático (schema.org/Product)',
				description: 'Expone el objeto estructurado JSON-LD para indexación y Rich Snippets en Google.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form'],
			productFormSlots: [{ slot: 'seo', mode: 'replace', componentKey: 'product_seo_fields' }],
			storefrontBlocks: ['product_open_graph_tags', 'product_json_ld']
		}
	}
};
