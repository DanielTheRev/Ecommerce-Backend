import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { AppError } from '@/errors/app.error';

const ALLOWED_WEIGHABLE_UNITS = ['kg', 'g', 'docena', 'un', 'l', 'ml'] as const;

export const weighableSettingsSchema = z.object({
	defaultUnit: z.enum(ALLOWED_WEIGHABLE_UNITS).default('kg'),
	pluBarcodePrefix: z.string().trim().max(4, 'El prefijo PLU no puede superar 4 dígitos').optional(),
	allowFractionalVariants: z.boolean().default(true)
});

export const weighableAddon: AddonModule = {
	manifest: {
		id: 'weighable',
		name: 'Balanza & Venta por Peso ($/Kg)',
		shortDescription: 'Habilita venta fraccionada por kilo, gramos o docena en Productos y POS.',
		category: 'producto',
		icon: 'scale',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4500,
		surfaces: ['admin_form', 'pos'],
		grantsCapabilities: ['hasScaleWeightPricing'],
		requiresSetup: false,
		configurableLabels: [
			{
				key: 'weightTitle',
				label: 'Título del módulo de balanza',
				description: 'Encabezado para productos fraccionados por kilo, gramo o docena.',
				defaultValue: 'Venta por Peso ($/Kg)',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'defaultUnit',
				label: 'Unidad de medida por defecto',
				description: 'Valores permitidos: kg, g, docena, un, l, ml.',
				type: 'string',
				defaultValue: 'kg'
			},
			{
				key: 'pluBarcodePrefix',
				label: 'Prefijo PLU de balanza',
				description: 'Prefijo de código de barras emitido por balanza física (máx. 4 dígitos).',
				type: 'string',
				defaultValue: '20'
			},
			{
				key: 'allowFractionalVariants',
				label: 'Permitir venta fraccionada en Variantes',
				description: 'Habilita stock y venta decimal en filas de Variant Studio (ej. Orígenes por Kg).',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form', 'product_pricing', 'inventory', 'pos'],
			productFormSlots: [{ slot: 'inventory_unit', mode: 'extend', componentKey: 'weighable_unit_pricing' }],
			interactions: [
				{ target: 'pos', behavior: 'Habilita venta fraccionada por peso/unidad (kg, g, docena, un, l, ml).' }
			]
		},
		settingsSchema: weighableSettingsSchema
	},
	hooks: {
		beforeProductValidate: (payload) => {
			if (payload.isSoldByWeight === true) {
				const unit = typeof payload.unit === 'string' ? payload.unit.trim().toLowerCase() : '';
				if (!unit || !ALLOWED_WEIGHABLE_UNITS.includes(unit as (typeof ALLOWED_WEIGHABLE_UNITS)[number])) {
					throw new AppError(
						'Weighable unit required',
						`Un producto pesable requiere una unidad válida (${ALLOWED_WEIGHABLE_UNITS.join(', ')}).`,
						400
					);
				}
			}
		}
	}
};
