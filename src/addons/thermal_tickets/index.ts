import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const thermalTicketsSettingsSchema = z.object({
	paperWidth: z.enum(['58mm', '80mm']).default('80mm'),
	autoPrintOnSale: z.boolean().default(true),
	cutPaper: z.boolean().default(true),
	openCashDrawer: z.boolean().default(false),
	footerCustomText: z.string().trim().max(120).optional()
});

/**
 * BORRADOR: Pendiente de implementación de drivers/generación ESC/POS para impresoras térmicas en POS.
 */
export const thermalTicketsAddon: AddonModule = {
	manifest: {
		id: 'thermal_tickets',
		name: 'Tickets Térmicos & Comandas POS (Borrador)',
		shortDescription: 'Impresión térmica 58mm/80mm y apertura de gaveta para el sistema POS.',
		category: 'operaciones',
		icon: 'print',
		implementationStatus: 'draft',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4000,
		surfaces: ['pos'],
		grantsCapabilities: [],
		requiresSetup: true,
		targets: {
			domains: ['pos'],
			adminScreens: ['settings/pos/thermal-printer']
		},
		settingsRoute: '/settings/pos/thermal-printer',
		settingsSchema: thermalTicketsSettingsSchema
	}
};
