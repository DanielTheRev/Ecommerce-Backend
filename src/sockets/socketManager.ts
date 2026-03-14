import {
	CreateAdminNotificationDto,
	CreateClientNotificationDto,
	INotification,
	NotificationAudience,
	NotificationSeverity,
	NotificationType
} from '@/interfaces/notification.interface';
import { IUser, Role } from '@/interfaces/user.interface';
import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection } from '@/config/modelRegistry';
import { parse } from 'cookie';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Socket, Server as SocketIOServer } from 'socket.io';

interface AuthSocket extends Socket {
	user?: IUser;
	tenantSlug?: string;
}

class SocketManager {
	private io: SocketIOServer | null = null;
	private connectedAdmins: Map<string, AuthSocket> = new Map();
	private connectedClients: Map<string, AuthSocket> = new Map();

	initialize(server: HTTPServer) {
		this.io = new SocketIOServer(server, {
			cors: {
				// En producción el tenant se valida en el middleware del socket
				// Permitimos todas las conexiones y validamos por x-tenant-id
				origin: true,
				credentials: true
			},
			path: '/api/socket.io',
			transports: ['websocket', 'polling']
		});

		this.setupMiddleware();
		this.setupEventHandlers();

		console.log('🔌 WebSocket Server initialized');
	}

	private setupMiddleware() {
		if (!this.io) return;

		this.io.use(async (socket: AuthSocket, next) => {
			try {
				const cookies = socket.handshake.headers.cookie;

				if (!cookies) return next(new Error('No cookies'));
				const parsed = parse(cookies);
				const token = parsed['token_b'];
				if (!token) return next(new Error('No token provided'));

				const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
					userID: string;
				};

				// WebSocket: resolve tenant from handshake headers or query
				const tenantSlug = (socket.handshake.headers['x-tenant-id'] as string)
					|| (socket.handshake.query['tenantId'] as string);

				if (!tenantSlug) {
					console.log('no tentant slug');
					return next(new Error('No tenant specified'));
				}

				const tenant = await connectionManager.getTenantBySlug(tenantSlug);
				if (!tenant) return next(new Error('Tenant not found'));

				const tenantDb = connectionManager.getTenantDb(tenant.dbName);
				const models = getModelsForConnection(tenantDb);

				const user = await models.User.findById(decoded.userID).lean() as IUser;
				socket.user = user;
				socket.tenantSlug = tenantSlug;

				next();
			} catch (error) {
				console.error('Socket authentication error:', error);
				next(new Error('Authentication failed'));
			}
		});
	}

	private setupEventHandlers() {
		if (!this.io) return;

		this.io.on('connection', (socket: AuthSocket) => {
			const { role, _id, name } = socket.user || {};
			const tenantSlug = socket.tenantSlug;

			if (role === Role.admin && tenantSlug) {
				this.connectedAdmins.set(socket.id, socket);
				socket.join(`admins_${tenantSlug}`);
				console.log(`🟢 Admin connected to tenant [${tenantSlug}]: ${name} (${socket.id})`);
			}

			if (role === Role.user && tenantSlug) {
				this.connectedClients.set(socket.id, socket);
				socket.join(`client_${_id}`);
				console.log(`🟢 Client connected to tenant [${tenantSlug}]: ${name} (${socket.id})`);
			}

			socket.on('disconnect', () => {
				if (role === Role.admin) {
					this.connectedAdmins.delete(socket.id);
					console.log(`🔴 Admin disconnected: ${name} (${socket.id})`);
				}
				if (role === Role.user) {
					this.connectedClients.delete(socket.id);
					console.log(`🔴 Client disconnected: ${name} (${socket.id})`);
				}
			});

			socket.emit('connection-success', {
				message: 'Conectado correctamente',
				user: socket.user,
				tenant: tenantSlug,
				timestamp: new Date().toISOString()
			});
		});
	}

	// === NOTIFICACIONES ===

	/**
	 * Notifica una nueva orden a los administradores de un tenant específico
	 */
	notifyNewOrderToAdmins(tenantSlug: string, order: any) {
		if (!this.io || !tenantSlug) return;

		const notification: CreateAdminNotificationDto = {
			type: NotificationType.NEW_ORDER,
			title: 'Nueva Orden Recibida',
			message: `Orden #${order.orderNumber || order._id} creada por valor de $${order.total}`,
			severity: NotificationSeverity.INFO,
			data: order,
			actionUrl: `/home/client-orders`
		};

	this.io.to(`admins_${tenantSlug}`).emit('admin-notification', this.buildNotification(notification, NotificationAudience.ADMIN));
	}

	/**
	 * Notifica que una orden ha sido actualizada (pago o envío)
	 */
	notifyOrderUpdatedToAdmins(tenantSlug: string, order: any, updateType: 'payment' | 'shipping' = 'payment') {
		if (!this.io || !tenantSlug) return;

		const notification: CreateAdminNotificationDto = {
			type: NotificationType.ORDER_STATUS_CHANGED,
			title: updateType === 'payment' ? 'Pago Actualizado' : 'Envio Actualizado',
			message: `La orden #${order.orderNumber || order._id} ha cambiado de estado.`,
			severity: NotificationSeverity.SUCCESS,
			data: order,
			actionUrl: `/home/client-orders`
		};

		this.io.to(`admins_${tenantSlug}`).emit('admin-notification', this.buildNotification(notification, NotificationAudience.ADMIN));
	}

	/**
	 * Notifica cualquier alerta de sistema a los administradores
	 */
	notifyAdminAlert(title: string, message: string, severity: NotificationSeverity = NotificationSeverity.INFO) {
		if (!this.io) return;

		const notification: CreateAdminNotificationDto = {
			type: NotificationType.SYSTEM_ALERT,
			title,
			message,
			severity
		};

		this.io.to('admins').emit('admin-notification', this.buildNotification(notification, NotificationAudience.ADMIN));
	}

	/**
	 * Notifica a un cliente específico (Versión Sanitizada)
	 */
	notifyClient(userId: string, notificationPayload: CreateClientNotificationDto) {
		if (!this.io) return;

		// Ensure we are not leaking unintended data, though TS types help, runtime check is good practice
		// Here we trust the DTO passed by the controller/service layer

		const finalNotification = this.buildNotification(notificationPayload, NotificationAudience.USER);

		this.io
			.to(`client_${userId}`)
			.emit('client-notification', finalNotification);
	}

	/**
	 * Notifica a todos los clientes (Ej: Anuncios generales)
	 */
	notifyAllClients(notificationPayload: CreateClientNotificationDto) {
		if (!this.io) return;

		const finalNotification = this.buildNotification(notificationPayload, NotificationAudience.USER);

		// Emit to all connected clients room or iterate
		// Since we don't have a 'clients' global room, we broadcast or iterate. 
		// Broadcasting to everyone except admins is tricky without a specific room. 
		// Assuming we want to emit to all sockets that are NOT in 'admins'?
		// For simplicity, let's iterate connected clients map which we maintain.

		for (const socket of this.connectedClients.values()) {
			socket.emit('client-notification', finalNotification);
		}
	}

	// Helper unificado
	private buildNotification(
		dto: CreateAdminNotificationDto | CreateClientNotificationDto,
		audience: NotificationAudience
	): INotification {
		return {
			id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date(),
			read: false,
			audience,
			...dto
		} as INotification;
	}

	// Stats
	getStats() {
		return {
			connectedAdmins: this.connectedAdmins.size,
			connectedClients: this.connectedClients.size,
			isInitialized: this.io !== null
		};
	}
}

export const socketManager = new SocketManager();
