import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const cashRegisterSettingsSchema = z.object({
	requireOpeningCashToSell: z.boolean().default(true),
	blindCashCountOnClose: z.boolean().default(false),
	allowCashWithdrawals: z.boolean().default(true)
});

export const cashRegisterAddon: AddonModule = {
	manifest: {
		id: 'cash_register',
		aliases: ['caja', 'cash_box'],
		name: 'Caja Registradora & Arqueos',
		shortDescription: 'Apertura, cierre de turno, movimientos de efectivo, egresos de caja y control de diferencias.',
		category: 'operaciones',
		icon: 'payments',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 5000,
		surfaces: ['admin_module', 'pos'],
		grantsCapabilities: ['hasCashRegister'],
		requiresSetup: false,
		settingsRoute: '/pos/cash-register',
		settingsSchema: cashRegisterSettingsSchema,
		configurableLabels: [
			{
				key: 'cashRegisterTitle',
				label: 'Título de Caja Registradora',
				description: 'Nombre del módulo de apertura y cierre de caja.',
				defaultValue: 'Caja Registradora & Turnos',
				surface: 'pos'
			}
		],
		configurableSettings: [
			{
				key: 'requireOpeningCashToSell',
				label: 'Exigir caja abierta para vender en mostrador',
				description: 'Solicita declarar el fondo inicial de cambio antes de registrar ventas en efectivo.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'blindCashCountOnClose',
				label: 'Cierre de caja ciego para empleados',
				description: 'El cajero debe declarar el efectivo contado sin ver el saldo teórico esperado hasta confirmar.',
				type: 'boolean',
				defaultValue: false
			},
			{
				key: 'allowCashWithdrawals',
				label: 'Permitir registrar retiros y gastos de caja chica',
				description: 'Habilita la carga de egresos de efectivo (pago a proveedores en mostrador, retiros, insumos).',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['pos'],
			adminScreens: ['pos/cash-register']
		}
	}
};
