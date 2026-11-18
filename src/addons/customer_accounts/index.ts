import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const customerAccountsSettingsSchema = z.object({
	allowQuickClientCreationInPos: z.boolean().default(true),
	enableCreditLineAndFiados: z.boolean().default(true),
	defaultCreditLimitARS: z.coerce.number().min(0).default(50000)
});

export const customerAccountsAddon: AddonModule = {
	manifest: {
		id: 'customer_accounts',
		aliases: ['customers', 'clients', 'crm'],
		name: 'Clientes, CRM & Cuentas Corrientes',
		shortDescription: 'Padrón de clientes, historial de compras, saldo a cuenta (fiados), límites de crédito y movimientos de cuenta corriente.',
		category: 'operaciones',
		icon: 'account_balance_wallet',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4500,
		surfaces: ['admin_module', 'pos'],
		grantsCapabilities: ['hasCustomerAccounts'],
		requiresSetup: false,
		settingsRoute: '/home/clients',
		settingsSchema: customerAccountsSettingsSchema,
		configurableLabels: [
			{
				key: 'customersModuleTitle',
				label: 'Título del módulo de Clientes',
				description: 'Encabezado de la pantalla de clientes y cuentas corrientes.',
				defaultValue: 'Clientes & Cuentas Corrientes',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'allowQuickClientCreationInPos',
				label: 'Permitir alta rápida de cliente desde Mostrador POS',
				description: 'Habilita crear un cliente nuevo con nombre y teléfono/DNI sin salir de la venta.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableCreditLineAndFiados',
				label: 'Habilitar Cuentas Corrientes (Ventas al Fiado / A Cuenta)',
				description: 'Permite anotar cargos y entregas parciales en la libreta digital del cliente.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'defaultCreditLimitARS',
				label: 'Límite de descubierto sugerido por cliente (ARS)',
				description: 'Monto máximo de deuda sugerido al habilitar cuenta corriente a un cliente.',
				type: 'number',
				defaultValue: 50000
			}
		],
		targets: {
			domains: ['pos', 'checkout'],
			adminScreens: ['customers', 'customers/accounts']
		}
	}
};
