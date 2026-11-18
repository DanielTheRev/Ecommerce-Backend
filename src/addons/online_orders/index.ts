import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const onlineOrdersSettingsSchema = z.object({
	requireReceiptForTransferOrder: z.boolean().default(true),
	autoApproveVerifiedTransfers: z.boolean().default(false),
	enableGuestOrderTracking: z.boolean().default(true),
	orderExpirationMinutes: z.coerce.number().int().min(10).max(10080).default(60)
});

export const onlineOrdersAddon: AddonModule = {
	manifest: {
		id: 'online_orders',
		aliases: ['web_orders', 'order_management'],
		name: 'Pedidos Online & Validación de Transferencias',
		shortDescription: 'Bandeja de órdenes online, verificación de comprobantes de transferencia, estados de preparación/envío y seguimiento del comprador.',
		category: 'operaciones',
		icon: 'shopping_cart_checkout',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 6000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasOnlineOrders'],
		requiresSetup: false,
		settingsRoute: '/home/client-orders',
		settingsSchema: onlineOrdersSettingsSchema,
		configurableLabels: [
			{
				key: 'onlineOrdersTitle',
				label: 'Título de Pedidos Online',
				description: 'Encabezado de la bandeja de órdenes de catálogo y tienda web.',
				defaultValue: 'Pedidos Online',
				surface: 'admin_module'
			},
			{
				key: 'approveTransferLabel',
				label: 'Texto del botón Aprobar Transferencia',
				description: 'Acción para confirmar la acreditación bancaria de un comprobante subido.',
				defaultValue: 'Aprobar Transferencia',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'requireReceiptForTransferOrder',
				label: 'Solicitar comprobante al pagar por Transferencia',
				description: 'Permite al comprador subir la captura/PDF del comprobante bancario desde el checkout o link de seguimiento.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableGuestOrderTracking',
				label: 'Habilitar seguimiento de pedido sin cuenta (/track)',
				description: 'Permite consultar el estado del pedido con número de orden y email.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'orderExpirationMinutes',
				label: 'Minutos de reserva de stock para órdenes impagas',
				description: 'Tiempo máximo antes de liberar el stock si no se acredita el pago (por defecto 60 min).',
				type: 'number',
				defaultValue: 60
			}
		],
		targets: {
			domains: ['checkout', 'inventory'],
			adminScreens: ['orders/online', 'orders/transfers'],
			storefrontBlocks: ['order_tracking', 'transfer_receipt_uploader']
		}
	}
};
