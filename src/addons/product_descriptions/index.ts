import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const productDescriptionsSettingsSchema = z.object({
	showSubtitle: z.boolean().default(true),
	showShortDescription: z.boolean().default(true),
	showRichDescription: z.boolean().default(true),
});

export const productDescriptionsAddon: AddonModule = {
	manifest: {
		id: 'product_descriptions',
		aliases: ['description_builder'],
		name: 'Description Builder — Descripciones & Storytelling',
		shortDescription:
			'Habilita subtítulo/bajada, descripción corta (extracto) y editor HTML sanitizado para storytelling de producto.',
		category: 'producto',
		icon: 'description',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3000,
		surfaces: ['admin_form', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		configurableLabels: [
			{
				key: 'title',
				label: 'Título del bloque de descripciones',
				description: 'Encabezado principal de Description Builder en el formulario de producto.',
				defaultValue: 'Descripción del Producto',
				surface: 'admin_form',
			},
			{
				key: 'subtitle',
				label: 'Subtítulo del bloque de descripciones',
				description: 'Texto de ayuda debajo del título de Description Builder.',
				defaultValue: 'Extracto rápido y storytelling HTML para tu tienda',
				surface: 'admin_form',
			},
			{
				key: 'subtitleFieldLabel',
				label: 'Label del campo Subtítulo / Bajada',
				description: 'Etiqueta del input corto debajo del nombre del producto.',
				defaultValue: 'Subtítulo / Bajada (Opcional)',
				surface: 'admin_form',
			},
			{
				key: 'shortDescriptionLabel',
				label: 'Label de Descripción Corta',
				description: 'Etiqueta del textarea de extracto rápido.',
				defaultValue: 'Descripción Corta (Extracto)',
				surface: 'admin_form',
			},
			{
				key: 'largeDescriptionLabel',
				label: 'Label de Descripción Detallada',
				description: 'Etiqueta del editor HTML enriquecido (Storytelling).',
				defaultValue: 'Descripción Detallada (Storytelling)',
				surface: 'admin_form',
			},
		],
		configurableSettings: [
			{
				key: 'showSubtitle',
				label: 'Habilitar Subtítulo / Bajada',
				description: 'Muestra el campo corto de subtítulo debajo del nombre del producto.',
				type: 'boolean',
				defaultValue: true,
			},
			{
				key: 'showShortDescription',
				label: 'Habilitar Descripción Corta',
				description: 'Muestra el textarea de extracto rápido del producto.',
				type: 'boolean',
				defaultValue: true,
			},
			{
				key: 'showRichDescription',
				label: 'Habilitar Editor HTML (Storytelling)',
				description: 'Muestra el editor de texto enriquecido sanitizado en el formulario.',
				type: 'boolean',
				defaultValue: true,
			},
		],
		targets: {
			domains: ['product_form'],
			productFormSlots: [
				{
					slot: 'descriptions',
					mode: 'replace',
					componentKey: 'product_descriptions_builder',
				},
			],
			storefrontBlocks: ['product_descriptions_rich'],
			interactions: [
				{
					target: 'product_form',
					behavior:
						'Controla la visibilidad de subtitle, shortDescription y largeDescription (HTML sanitizado con DOMPurify).',
				},
			],
		},
		settingsSchema: productDescriptionsSettingsSchema,
	},
};
