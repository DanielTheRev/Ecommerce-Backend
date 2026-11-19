import {
	CreateAdminNotificationDto,
	CreateClientNotificationDto,
	INotification,
	NotificationAudience,
	NotificationSeverity,
	NotificationType
} from '@/interfaces/notification.interface';
import { TenantModels } from '@/config/modelRegistry';
import { NotificationService } from '@/services/notification.service';
import { PushNotificationService } from '@/services/pushNotification.service';
import { socketManager, ActiveScannerInfo } from './socketManager';

/**
 * Interfaz unificada de servicio Realtime (Patrón Strategy / Adapter — DIP).
 * Permite desacoplar a los controladores y servicios del transporte en tiempo real.
 */
export interface IRealtimeService {
	notifyNewOrderToAdmins(tenantSlug: string, order: any): Promise<void> | void;
	notifyOrderUpdatedToAdmins(
		tenantSlug: string,
		order: any,
		updateType?: 'payment' | 'shipping'
	): Promise<void> | void;
	notifyReceiptUploadedToAdmins(tenantSlug: string, order: any): Promise<void> | void;
	notifyAdminAlert(
		title: string,
		message: string,
		severity?: NotificationSeverity,
		tenantSlug?: string
	): Promise<void> | void;
	notifyClient(
		userId: string,
		notificationPayload: CreateClientNotificationDto,
		models?: TenantModels,
		tenantSlug?: string
	): Promise<void>;
	notifyAllClients(
		notificationPayload: CreateClientNotificationDto,
		tenantSlug?: string
	): Promise<void> | void;
	broadcastScannedBarcode(
		tenantSlug: string,
		scanData: {
			barcode: string;
			product?: any;
			matchedVariant?: any;
			quantity?: number;
			scannedBy?: string;
			deviceId?: string;
			deviceName?: string;
			terminalId?: string;
		}
	): Promise<void> | void;
	notifyScannerStatus(tenantSlug: string, terminalId?: string): Promise<void> | void;
	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[];
}

/**
 * Implementación principal basada en Socket.IO (Proceso persistente Node.js / Ubuntu / AWS) + Expo Push.
 */
export class SocketRealtimeService implements IRealtimeService {
	private buildNotification(
		dto: CreateAdminNotificationDto | CreateClientNotificationDto,
		audience: NotificationAudience,
		customId?: string
	): INotification {
		return {
			id: customId || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
			timestamp: new Date(),
			read: false,
			audience,
			...dto
		} as INotification;
	}

	private formatOrderMeta(order: any) {
		const total = order.finance?.total ?? order.total ?? 0;
		const orderNum = order.orderNumber || (order._id ? String(order._id).slice(-6) : '');
		const formattedTotal = new Intl.NumberFormat('es-AR').format(total);
		const buyerName = order.buyerData?.firstName
			? `${order.buyerData.firstName} ${order.buyerData.lastName || ''}`.trim()
			: (order.buyerData?.name || 'Cliente');
		return { total, orderNum, formattedTotal, buyerName };
	}

	notifyNewOrderToAdmins(tenantSlug: string, order: any): void {
		const { orderNum, formattedTotal, buyerName } = this.formatOrderMeta(order);
		const fullNotification = this.buildNotification(
			{
				type: NotificationType.NEW_ORDER,
				title: 'Nueva Orden Recibida',
				message: `Orden #${orderNum} creada por valor de $${formattedTotal}`,
				severity: NotificationSeverity.INFO,
				data: order,
				actionUrl: `/home/client-orders`
			},
			NotificationAudience.ADMIN
		);

		if (socketManager.isInitialized) {
			socketManager.emitToAdmins(tenantSlug, 'admin-notification', fullNotification);
			console.log(`🌐 [Socket.io] 🛒 Nueva Venta emitida a admins_${tenantSlug} | Orden #${orderNum}`);
		}

		PushNotificationService.sendAdminPushNotification({
			tenantSlug,
			title: `¡Nueva Venta! 🛒 #${orderNum}`,
			body: `${buyerName} compró por $ ${formattedTotal}`,
			channelId: 'store_orders',
			data: { orderId: String(order._id), orderNumber: orderNum, type: 'new_order' }
		});
	}

	notifyOrderUpdatedToAdmins(
		tenantSlug: string,
		order: any,
		updateType: 'payment' | 'shipping' = 'payment'
	): void {
		const { orderNum, formattedTotal } = this.formatOrderMeta(order);
		const fullNotification = this.buildNotification(
			{
				type: NotificationType.ORDER_STATUS_CHANGED,
				title: updateType === 'payment' ? 'Pago Actualizado' : 'Envio Actualizado',
				message: `La orden #${orderNum} ha cambiado de estado.`,
				severity: NotificationSeverity.SUCCESS,
				data: order,
				actionUrl: `/home/client-orders`
			},
			NotificationAudience.ADMIN
		);

		if (socketManager.isInitialized) {
			socketManager.emitToAdmins(tenantSlug, 'admin-notification', fullNotification);
			console.log(`🌐 [Socket.io] 🔄 Orden #${orderNum} (${updateType}) emitida a admins_${tenantSlug}`);
		}

		if (updateType === 'payment') {
			const paymentStatus = order.paymentInfo?.status || order.paymentStatus;
			const normalizedStatus = String(paymentStatus || '').toLowerCase();
			const isApproved = normalizedStatus === 'approved' || normalizedStatus === 'paid';
			const isRejected = normalizedStatus === 'rejected' || normalizedStatus === 'failed';

			if (isApproved) {
				PushNotificationService.sendAdminPushNotification({
					tenantSlug,
					title: `Pago Aprobado 💳 #${orderNum}`,
					body: `Se acreditaron $ ${formattedTotal} de la orden #${orderNum}`,
					channelId: 'store_orders',
					data: { orderId: String(order._id), orderNumber: orderNum, type: 'payment_success' }
				});
			} else if (isRejected) {
				PushNotificationService.sendAdminPushNotification({
					tenantSlug,
					title: `Pago Rechazado ❌ #${orderNum}`,
					body: `El pago de la orden #${orderNum} fue rechazado.`,
					channelId: 'store_orders',
					data: { orderId: String(order._id), orderNumber: orderNum, type: 'payment_failed' }
				});
			} else {
				PushNotificationService.sendAdminPushNotification({
					tenantSlug,
					title: `Actualización de Pago 💳 #${orderNum}`,
					body: `Nuevo estado de pago: ${paymentStatus || 'pendiente'}`,
					channelId: 'store_orders',
					data: { orderId: String(order._id), orderNumber: orderNum, type: 'payment_status_changed' }
				});
			}
		} else {
			const shippingStatus = order.shippingInfo?.status || order.shippingStatus || 'actualizado';
			PushNotificationService.sendAdminPushNotification({
				tenantSlug,
				title: `Envío Actualizado 🚚 #${orderNum}`,
				body: `El envío de la orden #${orderNum} ahora está: ${shippingStatus}`,
				channelId: 'store_orders',
				data: { orderId: String(order._id), orderNumber: orderNum, type: 'order_status_changed' }
			});
		}
	}

	notifyReceiptUploadedToAdmins(tenantSlug: string, order: any): void {
		const { orderNum, formattedTotal } = this.formatOrderMeta(order);
		const fullNotification = this.buildNotification(
			{
				type: NotificationType.ORDER_STATUS_CHANGED,
				title: '🧾 Comprobante de Pago Cargado',
				message: `El cliente cargó un comprobante de pago para la orden #${orderNum}.`,
				severity: NotificationSeverity.INFO,
				data: order,
				actionUrl: `/home/client-orders`
			},
			NotificationAudience.ADMIN
		);

		if (socketManager.isInitialized) {
			socketManager.emitToAdmins(tenantSlug, 'admin-notification', fullNotification);
			console.log(`🌐 [Socket.io] 📄 Comprobante subido emitido a admins_${tenantSlug} | Orden #${orderNum}`);
		}

		PushNotificationService.sendAdminPushNotification({
			tenantSlug,
			title: `Comprobante de Transferencia 📄 #${orderNum}`,
			body: `El cliente subió el comprobante por $ ${formattedTotal}. Pendiente de revisión.`,
			channelId: 'store_orders',
			data: { orderId: String(order._id), orderNumber: orderNum, type: 'receipt_uploaded' }
		});
	}

	notifyAdminAlert(
		title: string,
		message: string,
		severity: NotificationSeverity = NotificationSeverity.INFO,
		tenantSlug?: string
	): void {
		const fullNotification = this.buildNotification(
			{
				type: NotificationType.SYSTEM_ALERT,
				title,
				message,
				severity
			},
			NotificationAudience.ADMIN
		);

		if (socketManager.isInitialized) {
			socketManager.emitToAdmins(tenantSlug || '', 'admin-notification', fullNotification);
			console.log(`🌐 [Socket.io] 🚨 Alerta emitida a admins_${tenantSlug || 'global'}: "${title}"`);
		}

		if (tenantSlug) {
			PushNotificationService.sendAdminPushNotification({
				tenantSlug,
				title,
				body: message,
				channelId: 'store_alerts',
				data: { type: 'system_alert', severity }
			});
		}
	}

	async notifyClient(
		userId: string,
		notificationPayload: CreateClientNotificationDto,
		models?: TenantModels,
		tenantSlug?: string
	): Promise<void> {
		let savedId: string | undefined;

		if (models) {
			const savedNotif = await NotificationService.createClientNotification(models, userId, notificationPayload);
			if (savedNotif) {
				savedId = savedNotif._id.toString();
			}
		}

		if (!tenantSlug) {
			throw new Error('[RealtimeService] tenantSlug es obligatorio para notificar a clientes');
		}
		const slug = tenantSlug.trim().toLowerCase();

		const finalNotification = this.buildNotification(notificationPayload, NotificationAudience.USER, savedId);

		if (socketManager.isInitialized) {
			socketManager.emitToClient(slug, userId, 'client-notification', finalNotification);
			console.log(`🌐 [Socket.io] 👤 Notificación emitida a [client_${slug}_${userId}]`);
		}
	}

	notifyAllClients(notificationPayload: CreateClientNotificationDto, tenantSlug?: string): void {
		if (!tenantSlug) {
			throw new Error('[RealtimeService] tenantSlug es obligatorio para notificar a clientes');
		}
		const slug = tenantSlug.trim().toLowerCase();
		const finalNotification = this.buildNotification(notificationPayload, NotificationAudience.USER);

		if (socketManager.isInitialized) {
			socketManager.emitToAllClients(slug, 'client-notification', finalNotification);
			console.log(`🌐 [Socket.io] 👥 Notificación masiva emitida a [clients_${slug}]`);
		}
	}

	broadcastScannedBarcode(
		tenantSlug: string,
		scanData: {
			barcode: string;
			product?: any;
			matchedVariant?: any;
			quantity?: number;
			scannedBy?: string;
			deviceId?: string;
			deviceName?: string;
			terminalId?: string;
		}
	): void {
		if (socketManager.isInitialized) {
			socketManager.broadcastScannedBarcode(tenantSlug, scanData);
		}
	}

	notifyScannerStatus(tenantSlug: string, terminalId?: string): void {
		if (socketManager.isInitialized) {
			socketManager.notifyScannerStatus(tenantSlug, terminalId);
		}
	}

	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		if (socketManager.isInitialized) {
			return socketManager.getActiveScanners(tenantSlug, terminalId);
		}
		return [];
	}
}

/* ============================================================================
 * @deprecated LEGACY: SupabaseRealtimeService (Desactivado por migración fuera de Vercel)
 * Se conserva comentado únicamente como referencia histórica en caso de rollback.
 *
 * export class SupabaseRealtimeService implements IRealtimeService {
 * 	private get supabaseUrl(): string {
 * 		return (process.env.SUPABASE_URL || '').replace(/\/$/, '');
 * 	}
 * 	private get serviceRoleKey(): string {
 * 		return (
 * 			process.env.SUPABASE_SERVICE_ROLE_KEY ||
 * 			process.env.SUPABASE_SECRET_KEY ||
 * 			process.env.SUPABASE_SERVICE_KEY ||
 * 			process.env.SUPABASE_KEY ||
 * 			''
 * 		);
 * 	}
 * 	private async broadcast(topic: string, event: string, payload: any): Promise<boolean> {
 * 		if (!this.supabaseUrl || !this.serviceRoleKey) return false;
 * 		const url = `${this.supabaseUrl}/realtime/v1/api/broadcast`;
 * 		const response = await fetch(url, {
 * 			method: 'POST',
 * 			headers: {
 * 				'Content-Type': 'application/json',
 * 				'apikey': this.serviceRoleKey,
 * 				'Authorization': `Bearer ${this.serviceRoleKey}`,
 * 				'User-Agent': 'Vexx-Backend-Realtime/1.0'
 * 			},
 * 			body: JSON.stringify({ messages: [{ topic: topic.trim().toLowerCase(), event, payload }] })
 * 		});
 * 		return response.ok;
 * 	}
 * }
 * ============================================================================ */

/**
 * Dispatcher único de Realtime:
 * Opera exclusivamente sobre Socket.IO + Expo Push (sin dependencias de Supabase/Vercel).
 */
class RealtimeServiceDispatcher implements IRealtimeService {
	private socketService = new SocketRealtimeService();

	public get providerName(): string {
		return 'socketio';
	}

	async notifyNewOrderToAdmins(tenantSlug: string, order: any): Promise<void> {
		this.socketService.notifyNewOrderToAdmins(tenantSlug, order);
	}

	async notifyOrderUpdatedToAdmins(
		tenantSlug: string,
		order: any,
		updateType: 'payment' | 'shipping' = 'payment'
	): Promise<void> {
		this.socketService.notifyOrderUpdatedToAdmins(tenantSlug, order, updateType);
	}

	async notifyReceiptUploadedToAdmins(tenantSlug: string, order: any): Promise<void> {
		this.socketService.notifyReceiptUploadedToAdmins(tenantSlug, order);
	}

	async notifyAdminAlert(
		title: string,
		message: string,
		severity: NotificationSeverity = NotificationSeverity.INFO,
		tenantSlug?: string
	): Promise<void> {
		this.socketService.notifyAdminAlert(title, message, severity, tenantSlug);
	}

	async notifyClient(
		userId: string,
		notificationPayload: CreateClientNotificationDto,
		models?: TenantModels,
		tenantSlug?: string
	): Promise<void> {
		await this.socketService.notifyClient(userId, notificationPayload, models, tenantSlug);
	}

	async notifyAllClients(
		notificationPayload: CreateClientNotificationDto,
		tenantSlug?: string
	): Promise<void> {
		this.socketService.notifyAllClients(notificationPayload, tenantSlug);
	}

	async broadcastScannedBarcode(
		tenantSlug: string,
		scanData: {
			barcode: string;
			product?: any;
			matchedVariant?: any;
			quantity?: number;
			scannedBy?: string;
			deviceId?: string;
			deviceName?: string;
			terminalId?: string;
		}
	): Promise<void> {
		this.socketService.broadcastScannedBarcode(tenantSlug, scanData);
	}

	async notifyScannerStatus(tenantSlug: string, terminalId?: string): Promise<void> {
		this.socketService.notifyScannerStatus(tenantSlug, terminalId);
	}

	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		return this.socketService.getActiveScanners(tenantSlug, terminalId);
	}
}

export const realtimeService = new RealtimeServiceDispatcher();
