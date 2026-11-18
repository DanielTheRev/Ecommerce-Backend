import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const dailySummarySettingsSchema = z.object({
	showNetProfitInSummary: z.boolean().default(true),
	showPaymentMethodBreakdown: z.boolean().default(true),
	allowStaffViewDailySummary: z.boolean().default(false)
});

export const dailySummaryAddon: AddonModule = {
	manifest: {
		id: 'daily_summary',
		aliases: ['daily_stats', 'sales_analytics'],
		name: 'Resumen Diario & Analítica de Ventas',
		shortDescription: 'KPIs del día, facturación por medio de pago (Efectivo, Transferencia, QR, Tarjetas), ticket promedio y ganancia estimada.',
		category: 'operaciones',
		icon: 'analytics',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4000,
		surfaces: ['admin_module'],
		grantsCapabilities: ['hasDailySummary'],
		requiresSetup: false,
		settingsRoute: '/home/daily-reports',
		settingsSchema: dailySummarySettingsSchema,
		configurableLabels: [
			{
				key: 'dailySummaryTitle',
				label: 'Título del Resumen Diario',
				description: 'Encabezado principal de la pantalla de cierre y métricas del día.',
				defaultValue: 'Resumen Diario & Métricas',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'showNetProfitInSummary',
				label: 'Mostrar ganancia neta estimada',
				description: 'Calcula la ganancia neta descontando costos de reposición y comisiones de pasarela.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showPaymentMethodBreakdown',
				label: 'Mostrar desglose por medio de pago',
				description: 'Detalla cuánto ingresó por Efectivo, Transferencia, QR y Tarjetas.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'allowStaffViewDailySummary',
				label: 'Permitir a empleados ver el resumen diario',
				description: 'Habilita la vista de cierre diario para cajeros/vendedores.',
				type: 'boolean',
				defaultValue: false
			}
		],
		targets: {
			domains: ['pos', 'checkout'],
			adminScreens: ['analytics/daily-summary', 'analytics/sales-stats']
		}
	}
};
