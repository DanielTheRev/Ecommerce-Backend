import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const fiscalAuditSettingsSchema = z.object({
	enableRecategorizationAlerts: z.boolean().default(true),
	alertThresholdPercent: z.coerce.number().min(50).max(100).default(80),
	includeDigitalSalesOnlyInProjection: z.boolean().default(false)
});

export const fiscalAuditAddon: AddonModule = {
	manifest: {
		id: 'fiscal_audit',
		aliases: ['monotributo_audit', 'tax_profile'],
		name: 'Arqueo Fiscal, Monotributo & IIBB',
		shortDescription: 'Control de topes de categoría de Monotributo (A-K), proyección de recategorización, Ingresos Brutos y facturación externa previa.',
		category: 'fiscal',
		icon: 'account_balance',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 5000,
		surfaces: ['admin_module'],
		grantsCapabilities: ['hasFiscalAudit'],
		requiresSetup: false,
		settingsRoute: '/settings/fiscal/profile',
		settingsSchema: fiscalAuditSettingsSchema,
		configurableLabels: [
			{
				key: 'fiscalAuditTitle',
				label: 'Título de Arqueo Fiscal',
				description: 'Encabezado del monitor fiscal y categoría de Monotributo.',
				defaultValue: 'Arqueo Fiscal & Monotributo',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableRecategorizationAlerts',
				label: 'Alertas preventivas de recategorización',
				description: 'Muestra alertas cuando la facturación acumulada se acerca al tope de la categoría actual.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'alertThresholdPercent',
				label: 'Porcentaje del tope para alerta amarilla (%)',
				description: 'Umbral de facturación sobre el límite de la categoría (ej. 80%).',
				type: 'number',
				defaultValue: 80
			},
			{
				key: 'includeDigitalSalesOnlyInProjection',
				label: 'Proyectar solo cobros electrónicos y facturados',
				description: 'Calcula el avance de categoría tomando únicamente cobros bancarizados/tarjetas/QR y facturas ARCA.',
				type: 'boolean',
				defaultValue: false
			}
		],
		targets: {
			domains: ['fiscal', 'pos', 'checkout'],
			adminScreens: ['fiscal/audit', 'settings/fiscal/profile'],
			interactions: [
				{
					target: 'arca_invoicing',
					behavior: 'Sincroniza el régimen impositivo (Monotributo / Responsable Inscripto) y el CUIT con la emisión de comprobantes.'
				}
			]
		}
	}
};
