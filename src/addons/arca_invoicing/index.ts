import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const arcaSettingsSchema = z.object({
	cuit: z
		.string()
		.trim()
		.regex(/^\d{11}$/, 'El CUIT debe tener exactamente 11 dígitos numéricos sin guiones'),
	ptoVta: z.coerce.number().int().min(1, 'El punto de venta debe ser mayor a 0').max(99999),
	isProduction: z.boolean().default(false),
	autoInvoiceOnSuccess: z.boolean().default(true)
});

export const arcaInvoicingAddon: AddonModule = {
	manifest: {
		id: 'arca_invoicing',
		name: 'Facturación Electrónica ARCA / AFIP',
		shortDescription: 'Emisión automática de comprobantes fiscales con CAE y código QR.',
		category: 'fiscal',
		icon: 'receipt_long',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 7500,
		surfaces: ['admin_module', 'pos'],
		grantsCapabilities: ['hasArcaBilling'],
		requiresSetup: true,
		targets: {
			domains: ['fiscal', 'pos'],
			adminScreens: ['settings/fiscal/arca', 'invoices']
		},
		settingsRoute: '/settings/fiscal/arca',
		settingsSchema: arcaSettingsSchema
	}
};
