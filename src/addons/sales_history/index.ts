import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const salesControlSettingsSchema = z.object({
	allowEmployeeCancelSale: z.boolean().default(false),
	enablePdfTicketDownload: z.boolean().default(true),
	showChannelBreakdown: z.boolean().default(true)
});

export const salesControlAddon: AddonModule = {
	manifest: {
		id: 'sales_control',
		aliases: ['sales_history', 'sales', 'orders_history'],
		name: 'Control de Ventas & Comprobantes',
		shortDescription: 'Control integral de ventas locales y online, estados de cobro, anulación y descarga de tickets PDF.',
		category: 'operaciones',
		icon: 'receipt',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_module', 'pos'],
		grantsCapabilities: ['hasSalesHistory'],
		requiresSetup: false,
		settingsRoute: '/sales',
		settingsSchema: salesControlSettingsSchema,
		configurableLabels: [
			{
				key: 'salesModuleTitle',
				label: 'Título del módulo de Ventas',
				description: 'Encabezado principal de la pantalla de control de ventas.',
				defaultValue: 'Control de Ventas & Comprobantes',
				surface: 'admin_module'
			},
			{
				key: 'localSaleButtonLabel',
				label: 'Texto del botón Nueva Venta',
				description: 'Etiqueta del botón de acceso rápido al mostrador.',
				defaultValue: 'Nueva Venta en Mostrador',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'allowEmployeeCancelSale',
				label: 'Permitir a empleados anular ventas',
				description: 'Si está desactivado, solo el administrador puede anular una venta cerrada.',
				type: 'boolean',
				defaultValue: false
			},
			{
				key: 'enablePdfTicketDownload',
				label: 'Habilitar descarga de Ticket PDF',
				description: 'Permite generar y compartir comprobantes PDF de cada operación.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showChannelBreakdown',
				label: 'Mostrar filtro por canal de venta',
				description: 'Muestra el origen de cada venta (Mostrador POS, Catálogo WhatsApp, Tienda Web).',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['pos', 'checkout'],
			adminScreens: ['sales', 'orders/history']
		}
	}
};

export const salesHistoryAddon = salesControlAddon;
