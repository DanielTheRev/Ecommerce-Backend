import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const detailsBuilderSettingsSchema = z.object({
	showSpecifications: z.boolean().default(true),
	showCareInstructions: z.boolean().default(false),
	showTags: z.boolean().default(true),
	showFeatures: z.boolean().default(false),
	allowBulkPaste: z.boolean().default(true),
	suggestedSpecKeysCsv: z.string().default(''),
	suggestedCareChipsCsv: z.string().default(''),
	specFieldsJson: z.string().default('')
});

export const detailsBuilderAddon: AddonModule = {
	manifest: {
		id: 'details_builder',
		aliases: ['tech_specs', 'product_details'],
		name: 'Details Builder — Atributos, Cuidados & Tags',
		shortDescription:
			'Motor clave-valor reutilizable con atributos destacables en tarjeta (isFeatured), cuidados y etiquetas de búsqueda.',
		category: 'producto',
		icon: 'list_alt',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 2500,
		surfaces: ['admin_form', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		settingsSchema: detailsBuilderSettingsSchema,
		configurableLabels: [
			{
				key: 'title',
				label: 'Título del bloque de detalles',
				description: 'Encabezado principal de Details Builder en el formulario de producto.',
				defaultValue: 'Detalles & Especificaciones',
				surface: 'admin_form'
			},
			{
				key: 'subtitle',
				label: 'Subtítulo del bloque de detalles',
				description: 'Texto guía debajo del título de Details Builder.',
				defaultValue: 'Atributos clave-valor, cuidados y etiquetas de búsqueda',
				surface: 'admin_form'
			},
			{
				key: 'specsTitle',
				label: 'Título de la tabla Clave-Valor',
				description: 'Encabezado de la tabla de atributos técnicos / composición.',
				defaultValue: 'Ficha Técnica (Atributos)',
				surface: 'admin_form'
			},
			{
				key: 'careInstructionsLabel',
				label: 'Label de Cuidados / Mantenimiento',
				description: 'Encabezado de la sección de instrucciones de cuidado o conservación.',
				defaultValue: 'Instrucciones de Cuidado',
				surface: 'admin_form'
			},
			{
				key: 'tagsLabel',
				label: 'Label de Etiquetas (Tags)',
				description: 'Encabezado del selector de tags para búsqueda y filtros.',
				defaultValue: 'Etiquetas de Búsqueda (Tags)',
				surface: 'admin_form'
			},
			{
				key: 'featuresLabel',
				label: 'Label de Características Destacadas',
				description: 'Encabezado de chips libres destacados (opcional si se usa ⭐ en Clave-Valor).',
				defaultValue: 'Características Destacadas',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'showSpecifications',
				label: 'Habilitar Tabla Clave-Valor',
				description: 'Muestra el constructor clave-valor (con opción ⭐ Destacar en tarjeta).',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showCareInstructions',
				label: 'Habilitar Cuidados / Mantenimiento',
				description: 'Muestra la lista/chips de instrucciones de cuidado (ideal Indumentaria/Alimentos).',
				type: 'boolean',
				defaultValue: false
			},
			{
				key: 'showTags',
				label: 'Habilitar Etiquetas (Tags)',
				description: 'Muestra el campo de tags para búsqueda y filtrado.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showFeatures',
				label: 'Habilitar Características Libres',
				description: 'Muestra chips libres extra aparte de los atributos clave-valor marcados con ⭐.',
				type: 'boolean',
				defaultValue: false
			},
			{
				key: 'allowBulkPaste',
				label: 'Permitir Pegar en Lote',
				description: 'Habilita el pegado rápido masivo de atributos y etiquetas.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'suggestedSpecKeysCsv',
				label: 'Claves sugeridas (separadas por coma)',
				description: 'Ej: Tela,Composición,Calce,Temporada,Género o Procesador,RAM,Almacenamiento.',
				type: 'string',
				defaultValue: ''
			},
			{
				key: 'suggestedCareChipsCsv',
				label: 'Cuidados sugeridos (separados por coma)',
				description: 'Ej: Lavar con agua fría,No usar secadora,Plancha tibia.',
				type: 'string',
				defaultValue: ''
			},
			{
				key: 'specFieldsJson',
				label: 'Campos estructurados JSON (text/select/required)',
				description: 'Array JSON opcional: [{"key":"Género","inputType":"select","required":true,"options":["Mujer","Hombre","Unisex"]}].',
				type: 'string',
				defaultValue: ''
			}
		],
		targets: {
			domains: ['product_form'],
			productFormSlots: [{ slot: 'specs', mode: 'replace', componentKey: 'details_builder_kv' }],
			storefrontBlocks: ['product_specifications_table']
		}
	}
};

export const techSpecsAddon = detailsBuilderAddon;
