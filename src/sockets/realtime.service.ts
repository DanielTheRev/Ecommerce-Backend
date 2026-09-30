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
 * Interfaz unificada de servicio Realtime (Patrón Strategy / Adapter)
 * Permite alternar de forma transparente entre Socket.io (monolito / local)
 * y Supabase Realtime Broadcast (Vercel Serverless / Cloud) mediante variable de entorno.
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
 * Implementación tradicional basada en Socket.io (Proceso persistente Node.js)
 */
export class SocketRealtimeService implements IRealtimeService {
	notifyNewOrderToAdmins(tenantSlug: string, order: any): void {
		socketManager.notifyNewOrderToAdmins(tenantSlug, order);
	}

	notifyOrderUpdatedToAdmins(
		tenantSlug: string,
		order: any,
		updateType: 'payment' | 'shipping' = 'payment'
	): void {
		socketManager.notifyOrderUpdatedToAdmins(tenantSlug, order, updateType);
	}

	notifyReceiptUploadedToAdmins(tenantSlug: string, order: any): void {
		socketManager.notifyReceiptUploadedToAdmins(tenantSlug, order);
	}

	notifyAdminAlert(
		title: string,
		message: string,
		severity: NotificationSeverity = NotificationSeverity.INFO,
		tenantSlug?: string
	): void {
		socketManager.notifyAdminAlert(title, message, severity, tenantSlug);
	}

	async notifyClient(
		userId: string,
		notificationPayload: CreateClientNotificationDto,
		models?: TenantModels
	): Promise<void> {
		await socketManager.notifyClient(userId, notificationPayload, models);
	}

	notifyAllClients(notificationPayload: CreateClientNotificationDto): void {
		socketManager.notifyAllClients(notificationPayload);
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
		socketManager.broadcastScannedBarcode(tenantSlug, scanData);
	}

	notifyScannerStatus(tenantSlug: string, terminalId?: string): void {
		socketManager.notifyScannerStatus(tenantSlug, terminalId);
	}

	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		return socketManager.getActiveScanners(tenantSlug, terminalId);
	}
}

/**
 * Implementación 100% Serverless basada en Supabase Realtime Broadcast (REST API)
 * Ideal para Vercel Serverless Functions: no mantiene sockets abiertos en el backend,
 * emite mensajes mediante HTTP en ~25ms con autenticación service_role.
 */
export class SupabaseRealtimeService implements IRealtimeService {
	private get supabaseUrl(): string {
		return (process.env.SUPABASE_URL || 'https://savyruhfhrkjqhtaozae.supabase.co').replace(/\/$/, '');
	}

	private get serviceRoleKey(): string {
		return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY || '';
	}

	/**
	 * Emite un mensaje de Broadcast a Supabase Realtime vía HTTP REST API
	 */
	private async broadcast(topic: string, event: string, payload: any): Promise<boolean> {
		if (!this.serviceRoleKey) {
			console.warn('[SupabaseRealtime] ⚠️ Falta SUPABASE_SERVICE_ROLE_KEY en variables de entorno');
			return false;
		}

		try {
			const cleanTopic = topic.trim().toLowerCase();
			const url = `${this.supabaseUrl}/realtime/v1/api/broadcast`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'apikey': this.serviceRoleKey,
					'Authorization': `Bearer ${this.serviceRoleKey}`
				},
				body: JSON.stringify({
					messages: [
						{
							topic: cleanTopic,
							event,
							payload
						}
					]
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`[SupabaseRealtime] ❌ Error ${response.status} emitiendo a [${cleanTopic}] -> ${event}:`, errorText);
				return false;
			}

			return true;
		} catch (error: any) {
			console.error(`[SupabaseRealtime] ❌ Excepción de red al emitir a [${topic}]:`, error?.message || error);
			return false;
		}
	}

	private buildNotification(
		dto: CreateAdminNotificationDto | CreateClientNotificationDto,
		audience: NotificationAudience
	): INotification {
		return {
			id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
			timestamp: new Date(),
			read: false,
			audience,
			...dto
		} as INotification;
	}

	async notifyNewOrderToAdmins(tenantSlug: string, order: any): Promise<void> {
		const total = order.finance?.total ?? order.total ?? 0;
		const orderNum = order.orderNumber || (order._id ? String(order._id).slice(-6) : '');
		const buyerName = order.buyerData?.firstName
			? `${order.buyerData.firstName} ${order.buyerData.lastName || ''}`.trim()
			: (order.buyerData?.name || 'Cliente');

		const notification: CreateAdminNotificationDto = {
			type: NotificationType.NEW_ORDER,
			title: 'Nueva Orden Recibida',
			message: `Orden #${orderNum} creada por valor de $${new Intl.NumberFormat('es-AR').format(total)}`,
			severity: NotificationSeverity.INFO,
			data: order,
			actionUrl: `/home/client-orders`
		};

		const fullNotification = this.buildNotification(notification, NotificationAudience.ADMIN);

		// 1. Emisión en tiempo real a Supabase (Canal de admins del tenant)
		await this.broadcast(`tenant:${tenantSlug}:admins`, 'admin-notification', fullNotification);
		console.log(`⚡ [Supabase Realtime] 🛒 Notificación de Nueva Venta emitida a [tenant:${tenantSlug}:admins] | Orden #${orderNum}`);

		// 2. Disparo Push a Dispositivos Móviles (Expo)
		PushNotificationService.sendAdminPushNotification({
			tenantSlug,
			title: `¡Nueva Venta! 🛒 #${orderNum}`,
			body: `${buyerName} compró por $ ${new Intl.NumberFormat('es-AR').format(total)}`,
			channelId: 'store_orders',
			data: { orderId: String(order._id), orderNumber: orderNum, type: 'new_order' }
		});
	}

	async notifyOrderUpdatedToAdmins(
		tenantSlug: string,
		order: any,
		updateType: 'payment' | 'shipping' = 'payment'
	): Promise<void> {
		const total = order.finance?.total ?? order.total ?? 0;
		const orderNum = order.orderNumber || (order._id ? String(order._id).slice(-6) : '');
		const formattedTotal = new Intl.NumberFormat('es-AR').format(total);

		const notification: CreateAdminNotificationDto = {
			type: NotificationType.ORDER_STATUS_CHANGED,
			title: updateType === 'payment' ? 'Pago Actualizado' : 'Envio Actualizado',
			message: `La orden #${orderNum} ha cambiado de estado.`,
			severity: NotificationSeverity.SUCCESS,
			data: order,
			actionUrl: `/home/client-orders`
		};

		const fullNotification = this.buildNotification(notification, NotificationAudience.ADMIN);

		// 1. Emisión Supabase
		await this.broadcast(`tenant:${tenantSlug}:admins`, 'admin-notification', fullNotification);
		console.log(`⚡ [Supabase Realtime] 🔄 Notificación de Orden #${orderNum} (${updateType}) emitida a [tenant:${tenantSlug}:admins]`);

		// 2. Disparo Push a Móvil
		if (updateType === 'payment') {
			const paymentStatus = order.paymentInfo?.status || order.paymentStatus;
			const isApproved = paymentStatus === 'approved' || paymentStatus === 'PAID';
			const isRejected = paymentStatus === 'rejected' || paymentStatus === 'REJECTED';

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

	async notifyReceiptUploadedToAdmins(tenantSlug: string, order: any): Promise<void> {
		const total = order.finance?.total ?? order.total ?? 0;
		const orderNum = order.orderNumber || (order._id ? String(order._id).slice(-6) : '');
		const formattedTotal = new Intl.NumberFormat('es-AR').format(total);

		const notification: CreateAdminNotificationDto = {
			type: NotificationType.ORDER_STATUS_CHANGED,
			title: '🧾 Comprobante de Pago Cargado',
			message: `El cliente cargó un comprobante de pago para la orden #${orderNum}.`,
			severity: NotificationSeverity.INFO,
			data: order,
			actionUrl: `/home/client-orders`
		};

		const fullNotification = this.buildNotification(notification, NotificationAudience.ADMIN);

		await this.broadcast(`tenant:${tenantSlug}:admins`, 'admin-notification', fullNotification);
		console.log(`⚡ [Supabase Realtime] 📄 Comprobante subido emitido a [tenant:${tenantSlug}:admins] | Orden #${orderNum}`);

		PushNotificationService.sendAdminPushNotification({
			tenantSlug,
			title: `Comprobante de Transferencia 📄 #${orderNum}`,
			body: `El cliente subió el comprobante por $ ${formattedTotal}. Pendiente de revisión.`,
			channelId: 'store_orders',
			data: { orderId: String(order._id), orderNumber: orderNum, type: 'receipt_uploaded' }
		});
	}

	async notifyAdminAlert(
		title: string,
		message: string,
		severity: NotificationSeverity = NotificationSeverity.INFO,
		tenantSlug?: string
	): Promise<void> {
		const notification: CreateAdminNotificationDto = {
			type: NotificationType.SYSTEM_ALERT,
			title,
			message,
			severity
		};

		const fullNotification = this.buildNotification(notification, NotificationAudience.ADMIN);
		const topic = tenantSlug ? `tenant:${tenantSlug}:admins` : 'global:admins';

		await this.broadcast(topic, 'admin-notification', fullNotification);
		console.log(`⚡ [Supabase Realtime] 🚨 Alerta de Sistema emitida a [${topic}]: "${title}" - ${message}`);

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
		let notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		if (models) {
			const savedNotif = await NotificationService.createClientNotification(models, userId, notificationPayload);
			if (savedNotif) {
				notificationId = savedNotif._id.toString();
			}
		}

		const finalNotification: INotification = {
			id: notificationId,
			timestamp: new Date(),
			read: false,
			audience: NotificationAudience.USER,
			...notificationPayload
		};

		const slug = tenantSlug || 'vura';
		await this.broadcast(`tenant:${slug}:client:${userId}`, 'client-notification', finalNotification);
		console.log(`⚡ [Supabase Realtime] 👤 Notificación emitida a cliente [tenant:${slug}:client:${userId}]: "${notificationPayload.title}"`);
	}

	async notifyAllClients(
		notificationPayload: CreateClientNotificationDto,
		tenantSlug?: string
	): Promise<void> {
		const finalNotification = this.buildNotification(notificationPayload, NotificationAudience.USER);
		const slug = tenantSlug || 'vura';
		await this.broadcast(`tenant:${slug}:clients:all`, 'client-notification', finalNotification);
		console.log(`⚡ [Supabase Realtime] 👥 Notificación masiva emitida a [tenant:${slug}:clients:all]`);
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
		const eventPayload = {
			barcode: scanData.barcode.trim(),
			product: scanData.product || null,
			matchedVariant: scanData.matchedVariant || null,
			quantity: scanData.quantity || 1,
			scannedBy: scanData.scannedBy || 'REST Fallback',
			deviceId: scanData.deviceId || 'rest-api',
			deviceName: scanData.deviceName || 'Móvil (REST)',
			terminalId: scanData.terminalId || null,
			timestamp: new Date().toISOString()
		};

		if (scanData.terminalId) {
			const terminalTopic = `tenant:${tenantSlug}:terminal:${scanData.terminalId.trim().toLowerCase()}`;
			await this.broadcast(terminalTopic, 'pos:barcode_scanned', eventPayload);
		}

		await this.broadcast(`tenant:${tenantSlug}:pos`, 'pos:barcode_scanned', eventPayload);
		await this.broadcast(`tenant:${tenantSlug}:admins`, 'pos:barcode_scanned', eventPayload);
		console.log(`⚡ [Supabase Realtime] 📷 Barcode [${scanData.barcode}] transmitido a terminal [${scanData.terminalId || 'GLOBAL'}]`);
	}

	async notifyScannerStatus(tenantSlug: string, terminalId?: string): Promise<void> {
		const payload = {
			connected: true,
			scannersCount: 1,
			terminalId: terminalId || null,
			timestamp: new Date().toISOString()
		};

		if (terminalId) {
			await this.broadcast(`tenant:${tenantSlug}:terminal:${terminalId.trim().toLowerCase()}`, 'pos:scanner_status', payload);
		}
		await this.broadcast(`tenant:${tenantSlug}:pos`, 'pos:scanner_status', payload);
		await this.broadcast(`tenant:${tenantSlug}:admins`, 'pos:scanner_status', payload);
	}

	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		// En arquitectura serverless sin estado de memoria persistente,
		// los escáneres se reportan por heartbeat o por REST
		return [];
	}
}

/**
 * Factory / Dispatcher inteligente:
 * Selecciona la implementación según REALTIME_PROVIDER ('supabase' | 'socketio').
 * Por defecto mantiene 'socketio' para máxima retrocompatibilidad y desarrollo local.
 */
class RealtimeServiceDispatcher implements IRealtimeService {
	private socketService = new SocketRealtimeService();
	private supabaseService = new SupabaseRealtimeService();

	private get activeService(): IRealtimeService {
		const provider = (process.env.REALTIME_PROVIDER || 'socketio').trim().toLowerCase();
		if (provider === 'supabase') {
			return this.supabaseService;
		}
		return this.socketService;
	}

	public get providerName(): string {
		return (process.env.REALTIME_PROVIDER || 'socketio').trim().toLowerCase();
	}

	async notifyNewOrderToAdmins(tenantSlug: string, order: any): Promise<void> {
		await this.activeService.notifyNewOrderToAdmins(tenantSlug, order);
	}

	async notifyOrderUpdatedToAdmins(
		tenantSlug: string,
		order: any,
		updateType: 'payment' | 'shipping' = 'payment'
	): Promise<void> {
		await this.activeService.notifyOrderUpdatedToAdmins(tenantSlug, order, updateType);
	}

	async notifyReceiptUploadedToAdmins(tenantSlug: string, order: any): Promise<void> {
		await this.activeService.notifyReceiptUploadedToAdmins(tenantSlug, order);
	}

	async notifyAdminAlert(
		title: string,
		message: string,
		severity: NotificationSeverity = NotificationSeverity.INFO,
		tenantSlug?: string
	): Promise<void> {
		await this.activeService.notifyAdminAlert(title, message, severity, tenantSlug);
	}

	async notifyClient(
		userId: string,
		notificationPayload: CreateClientNotificationDto,
		models?: TenantModels,
		tenantSlug?: string
	): Promise<void> {
		await this.activeService.notifyClient(userId, notificationPayload, models, tenantSlug);
	}

	async notifyAllClients(
		notificationPayload: CreateClientNotificationDto,
		tenantSlug?: string
	): Promise<void> {
		await this.activeService.notifyAllClients(notificationPayload, tenantSlug);
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
		await this.activeService.broadcastScannedBarcode(tenantSlug, scanData);
	}

	async notifyScannerStatus(tenantSlug: string, terminalId?: string): Promise<void> {
		await this.activeService.notifyScannerStatus(tenantSlug, terminalId);
	}

	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		return this.activeService.getActiveScanners(tenantSlug, terminalId);
	}
}

export const realtimeService = new RealtimeServiceDispatcher();
