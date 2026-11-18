import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const variantsSettingsSchema = z.object({
	allowPerVariantPrice: z.boolean().default(true),
	allowPerVariantMargin: z.boolean().default(true),
	showColorColumn: z.boolean().optional(),
	showSizeColumn: z.boolean().optional(),
	showVolumeColumn: z.boolean().optional(),
	showAttributesColumn: z.boolean().optional()
});

export const variantsAddon: AddonModule = {
	manifest: {
		id: 'variants',
		aliases: ['variant_studio'], // [REMOVE-BEFORE-PROD]: evaluar si el ID canonico final en prod será 'variant_studio' o 'variants'
		name: 'Variant Studio — Variantes & Presentaciones',
		shortDescription:
			'Grilla universal de talles, colores, tamaños, orígenes o capacidades con stock, barcode, precio/margen propio y ejes públicos.',
		category: 'producto',
		icon: 'style',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4000,
		surfaces: ['admin_form', 'pos', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		configurableLabels: [
			{
				key: 'variantsTitle',
				label: 'Título de la grilla de variantes',
				description: 'Encabezado principal del módulo Variant Studio en el formulario de producto.',
				defaultValue: 'Variantes & Presentaciones',
				surface: 'admin_form'
			},
			{
				key: 'variantsSubtitle',
				label: 'Subtítulo / ayuda de variantes',
				description: 'Texto guía debajo del título de Variant Studio.',
				defaultValue: 'Configurá presentaciones, talles, colores o atributos con stock y precio propio.',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'allowPerVariantPrice',
				label: 'Permitir precio propio por variante',
				description: 'Habilita costo proveedor independiente por cada fila de variante.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'allowPerVariantMargin',
				label: 'Permitir margen propio por variante',
				description: 'Habilita porcentaje de ganancia independiente por variante.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showColorColumn',
				label: 'Mostrar columna Color (override cliente)',
				description: 'Fuerza la visibilidad de la columna Color para este comercio.',
				type: 'boolean',
				defaultValue: false
			},
			{
				key: 'showSizeColumn',
				label: 'Mostrar columna Talle (override cliente)',
				description: 'Fuerza la visibilidad de la columna Talle para este comercio.',
				type: 'boolean',
				defaultValue: false
			},
			{
				key: 'showVolumeColumn',
				label: 'Mostrar columna Presentación / Origen',
				description: 'Fuerza la visibilidad de la columna Presentación/Medida/Origen.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showAttributesColumn',
				label: 'Mostrar columna Atributos Clave-Valor',
				description: 'Habilita atributos libres (ej. Almacenamiento, Rosca, Material).',
				type: 'boolean',
				defaultValue: false
			}
		],
		targets: {
			domains: ['product_form', 'inventory', 'pos', 'storefront_prices'],
			productFormSlots: [{ slot: 'variants', mode: 'extend', componentKey: 'variant_studio_matrix' }],
			storefrontBlocks: ['variant_selector', 'variant_axes'],
			interactions: [
				{
					target: 'pos',
					behavior:
						'Resuelve variante exacta por barcode/SKU y muestra variant.label (ej. "2.25 Litros", "M · Crema", "128GB · Titanio").'
				},
				{
					target: 'media_studio',
					behavior:
						'Sincroniza variantSkus[] con las imágenes del producto para mostrar múltiples fotos por variante en tienda.'
				},
				{
					target: 'price_builder',
					behavior:
						'Permite costo proveedor y ganancia (%) propios por variante (inheritPrice: false) calculando sus canales de pago.'
				}
			]
		},
		settingsSchema: variantsSettingsSchema
	}
};
