import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const expirationsSettingsSchema = z.object({
	alertDaysBefore: z.coerce.number().int().min(1).max(365).default(15),
	blockExpiredInPos: z.boolean().default(false)
});

/**
 * BORRADOR: Pendiente de implementación de lotes y alertas de vencimiento para almacenes/kioscos.
 */
export const expirationsAddon: AddonModule = {
	manifest: {
		id: 'expirations',
		name: 'Lotes y Alertas de Vencimiento (Borrador)',
		shortDescription: 'Control de fechas de vencimiento con alertas anticipadas para alimentos y bebidas.',
		category: 'producto',
		icon: 'event_busy',
		implementationStatus: 'draft',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4000,
		surfaces: ['admin_form', 'admin_module', 'pos'],
		grantsCapabilities: [],
		requiresSetup: true,
		targets: {
			domains: ['product_form', 'inventory', 'pos'],
			productFormSlots: [{ slot: 'expirations', mode: 'extend', componentKey: 'batch_expiration_dates' }],
			adminScreens: ['inventory/expirations'],
			interactions: [
				{ target: 'pos', behavior: 'Alertas y control FEFO por lote/vencimiento al vender en mostrador.' }
			]
		},
		settingsSchema: expirationsSettingsSchema
	}
};
