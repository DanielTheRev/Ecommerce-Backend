import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const crossSellStudioSettingsSchema = z.object({
	allowVariantSelection: z.boolean().default(true),
	maxItems: z.number().int().min(1).max(24).default(8),
	showInStorefront: z.boolean().default(true)
});

export const crossSellStudioAddon: AddonModule = {
	manifest: {
		id: 'cross_sell_studio',
		aliases: ['cross_sell', 'shop_the_look'],
		name: 'Cross-Sell Studio — Combina Con & Recomendados',
		shortDescription:
			'Permite vincular productos relacionados (Completa el Look, accesorios compatibles o acompañamientos) con variante exacta opcional.',
		category: 'marketing',
		icon: 'auto_awesome_mosaic',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_form', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		settingsSchema: crossSellStudioSettingsSchema,
		configurableLabels: [
			{
				key: 'crossSellTitle',
				label: 'Título del bloque Cross-Sell',
				description: 'Ej: "Prendas que combinan (Completa el Look)" o "Accesorios Compatibles".',
				defaultValue: 'Productos que Combinan',
				surface: 'admin_form'
			},
			{
				key: 'crossSellSubtitle',
				label: 'Subtítulo del bloque Cross-Sell',
				description: 'Texto guía debajo del título del bloque.',
				defaultValue: 'Vinculá productos del catálogo que aparecen en la foto o complementan la compra.',
				surface: 'admin_form'
			},
			{
				key: 'searchPlaceholder',
				label: 'Placeholder del buscador',
				description: 'Texto de ayuda dentro del buscador de productos relacionados.',
				defaultValue: 'Buscar producto por nombre, categoría o SKU...',
				surface: 'admin_form'
			},
			{
				key: 'storefrontBlockTitle',
				label: 'Título en la Tienda Pública',
				description: 'Encabezado que ve el comprador en la web (ej. "Combinalo con" o "Llevátelo con").',
				defaultValue: 'Combinalo con',
				surface: 'storefront_section'
			}
		],
		configurableSettings: [
			{
				key: 'allowVariantSelection',
				label: 'Permitir elegir variante exacta (variantSku)',
				description: 'Permite seleccionar qué color/talle/capacidad exacta del producto relacionado se recomienda.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'maxItems',
				label: 'Máximo de productos vinculados',
				description: 'Cantidad máxima de productos recomendados por artículo (1-24).',
				type: 'number',
				defaultValue: 8
			},
			{
				key: 'showInStorefront',
				label: 'Mostrar bloque en Tienda Pública',
				description: 'Habilita la sección "Combinalo con" en la ficha pública del producto.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form'],
			productFormSlots: [{ slot: 'bundles', mode: 'extend', componentKey: 'cross_sell_studio_picker' }],
			storefrontBlocks: ['product_combine_with']
		}
	}
};
