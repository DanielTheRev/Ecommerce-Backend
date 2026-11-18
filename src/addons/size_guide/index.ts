import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const sizeGuideSettingsSchema = z.object({
	allowCustomColumns: z.boolean().default(true),
	showToleranceField: z.boolean().default(true)
});

export const sizeGuideAddon: AddonModule = {
	manifest: {
		id: 'size_guide',
		name: 'Guía de Talles & Medidas',
		shortDescription:
			'Tabla matricial 2D de talles y medidas (Busto, Cintura, Largo, Calzado, Dimensiones) con tolerancia configurable.',
		category: 'producto',
		icon: 'straighten',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 2500,
		surfaces: ['admin_form', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		settingsSchema: sizeGuideSettingsSchema,
		configurableLabels: [
			{
				key: 'sizeGuideTitle',
				label: 'Título de Guía de Talles / Medidas',
				description: 'Encabezado del bloque de tabla de medidas en producto y tienda.',
				defaultValue: 'Guía de Talles & Medidas',
				surface: 'admin_form'
			},
			{
				key: 'sizeGuideSubtitle',
				label: 'Subtítulo de Guía de Talles',
				description: 'Texto de ayuda debajo del título de la tabla de medidas.',
				defaultValue: 'Cargá las medidas por talle o dimensión para evitar devoluciones.',
				surface: 'admin_form'
			},
			{
				key: 'toleranceLabel',
				label: 'Label de Tolerancia',
				description: 'Etiqueta del campo opcional de margen de tolerancia (ej. +/- 1-2 cm).',
				defaultValue: 'Tolerancia / Aclaración',
				surface: 'admin_form'
			},
			{
				key: 'addRowLabel',
				label: 'Label del botón Agregar Fila',
				description: 'Texto del botón para sumar filas (ej. "+ Talle" en moda o "+ Medida" en muebles).',
				defaultValue: '+ Medida / Fila',
				surface: 'admin_form'
			},
			{
				key: 'templatesLabel',
				label: 'Label de Modelos Rápidos',
				description: 'Encabezado de los chips/plantillas reutilizables de medidas.',
				defaultValue: 'Modelos rápidos',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'allowCustomColumns',
				label: 'Permitir columnas personalizadas',
				description: 'Permite agregar o renombrar columnas de medidas (ej. Busto, Largo, Ancho).',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showToleranceField',
				label: 'Habilitar campo de Tolerancia',
				description: 'Muestra el campo de margen de error / aclaración debajo de la tabla.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form'],
			productFormSlots: [{ slot: 'specs', mode: 'extend', componentKey: 'size_guide_matrix' }],
			storefrontBlocks: ['product_size_guide_modal']
		}
	}
};
