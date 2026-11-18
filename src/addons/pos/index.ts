import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const posSettingsSchema = z.object({
	transferValidationMode: z.enum(['fast_receipt', 'strict_admin_approval']).default('fast_receipt'),
	allowManualDiscount: z.boolean().default(true),
	autoPrintReceipt: z.boolean().default(false),
	enableMobileBarcodeScanner: z.boolean().default(true),
	enablePointTerminalIntegration: z.boolean().default(true)
});

export const posAddon: AddonModule = {
	manifest: {
		id: 'pos',
		aliases: ['point_of_sale', 'mostrador'],
		name: 'Punto de Venta (POS Mostrador)',
		shortDescription: 'Caja rápida de mostrador, escáner de códigos de barra desde el celular, terminales Point y cobros presenciales.',
		category: 'operaciones',
		icon: 'point_of_sale',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 8000,
		surfaces: ['admin_module', 'pos'],
		grantsCapabilities: ['hasPos', 'hasInStorePaymentConfig'],
		requiresSetup: false,
		settingsRoute: '/pos',
		settingsSchema: posSettingsSchema,
		configurableLabels: [
			{
				key: 'posModuleTitle',
				label: 'Título del Mostrador POS',
				description: 'Encabezado principal de la terminal de punto de venta.',
				defaultValue: 'Mostrador POS',
				surface: 'pos'
			}
		],
		configurableSettings: [
			{
				key: 'transferValidationMode',
				label: 'Modo de validación de Transferencias en Mostrador',
				description: 'fast_receipt (cierre rápido con comprobante) o strict_admin_approval (requiere confirmación del administrador).',
				type: 'string',
				defaultValue: 'fast_receipt'
			},
			{
				key: 'allowManualDiscount',
				label: 'Permitir descuento manual en mostrador',
				description: 'Permite al cajero aplicar un descuento puntual sobre el total de la venta.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'autoPrintReceipt',
				label: 'Imprimir comprobante automáticamente al cobrar',
				description: 'Dispara el diálogo de impresión de ticket al cerrar la operación.',
				type: 'boolean',
				defaultValue: false
			},
			{
				key: 'enableMobileBarcodeScanner',
				label: 'Habilitar emparejamiento de Escáner Móvil (Socket.IO)',
				description: 'Permite usar la cámara del celular con la app Android como lector de código de barras inalámbrico.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enablePointTerminalIntegration',
				label: 'Habilitar integración con Posnet / Mercado Pago Point',
				description: 'Permite enviar el monto a cobrar directamente a la terminal física Point.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['pos', 'checkout'],
			adminScreens: ['pos', 'settings/payments'],
			interactions: [
				{ target: 'price_builder', behavior: 'Consume los canales presenciales (Efectivo, QR, Débito Point) al cobrar en mostrador.' }
			]
		}
	}
};
