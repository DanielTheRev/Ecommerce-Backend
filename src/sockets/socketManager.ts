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
import { getModelsForConnection, TenantModels } from '@/config/modelRegistry';
import { NotificationService } from '@/services/notification.service';
import { parse } from 'cookie';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Socket, Server as SocketIOServer } from 'socket.io';

export interface ActiveScannerInfo {
	socketId: string;
	userId: string;
	userName: string;
	tenantSlug: string;
	deviceId: string;
	deviceName: string;
	terminalId?: string;
	connectedAt: Date;
	lastScanAt?: Date;
}

export interface ScanBarcodePayload {
	barcode: string;
	terminalId?: string;
	deviceId?: string;
	deviceName?: string;
	quantity?: number;
}

export interface ScanBarcodeAckResponse {
	success: boolean;
	found: boolean;
	barcode: string;
	message: string;
	product: any | null;
	matchedVariant: any | null;
}

interface AuthSocket extends Socket {
	user?: IUser;
	tenantSlug?: string;
	isScanner?: boolean;
	scannerDeviceId?: string;
	scannerTerminalId?: string;
}

class SocketManager {
	private io: SocketIOServer | null = null;
	private connectedAdmins: Map<string, AuthSocket> = new Map();
	private connectedClients: Map<string, AuthSocket> = new Map();
	private activeScanners: Map<string, ActiveScannerInfo> = new Map();

	initialize(server: HTTPServer) {
		this.io = new SocketIOServer(server, {
			cors: {
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
				let token: string | undefined;

				// 1. Extraer token de auth object (Socket.io v4 client estándar para React Native / Android)
				if (socket.handshake.auth && typeof socket.handshake.auth.token === 'string') {
					token = socket.handshake.auth.token.trim();
				}

				// 2. Extraer de headers Authorization (Bearer token)
				if (!token && socket.handshake.headers.authorization) {
					const authHeader = String(socket.handshake.headers.authorization).trim();
					if (authHeader.startsWith('Bearer ')) {
						token = authHeader.split(' ')[1];
					} else {
						token = authHeader;
					}
				}

				// 3. Extraer de query params (?token=...)
				if (!token && typeof socket.handshake.query?.token === 'string') {
					token = String(socket.handshake.query.token).trim();
				}

				// 4. Extraer de cookies (para clientes web del panel de control)
				if (!token && socket.handshake.headers.cookie) {
					try {
						const parsed = parse(socket.handshake.headers.cookie);
						token = parsed['token_b'];
					} catch (e) {}
				}

				if (!token) {
					return next(new Error('[WS] Authentication failed: No token provided'));
				}

				// Verificar JWT
				let decoded: any;
				try {
					decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
						userID: string;
						tenantSlug?: string;
						role?: string;
					};
				} catch (err: any) {
					console.error('[WS] JWT verification failed:', err.message);
					return next(new Error('[WS] Authentication failed: Invalid or expired token'));
				}

				// Resolver tenantSlug
				let tenantSlug: string | undefined;

				// De auth object
				if (socket.handshake.auth && typeof socket.handshake.auth.tenantSlug === 'string') {
					tenantSlug = socket.handshake.auth.tenantSlug.trim().toLowerCase();
				}

				// De headers
				if (!tenantSlug) {
					const headerTenant = socket.handshake.headers['x-tenant-id'] || socket.handshake.headers['x-tenant-slug'];
					if (typeof headerTenant === 'string') {
						tenantSlug = headerTenant.trim().toLowerCase();
					}
				}

				// De query
				if (!tenantSlug) {
					const queryTenant = socket.handshake.query['tenantId'] || socket.handshake.query['tenantSlug'];
					if (typeof queryTenant === 'string') {
						tenantSlug = queryTenant.trim().toLowerCase();
					}
				}

				// Del JWT payload
				if (!tenantSlug && decoded.tenantSlug) {
					tenantSlug = String(decoded.tenantSlug).trim().toLowerCase();
				}

				if (!tenantSlug) {
					console.log('[WS] No tenant slug resolved');
					return next(new Error('[WS] Authentication failed: No tenant specified'));
				}

				const tenant = await connectionManager.getTenantBySlug(tenantSlug);
				if (!tenant) return next(new Error('[WS] Tenant not found'));

				const tenantDb = connectionManager.getTenantDb(tenant.dbName);
				const models = getModelsForConnection(tenantDb);

				const user = await models.User.findById(decoded.userID).lean() as IUser;
				if (!user) {
					return next(new Error('[WS] User not found'));
				}

				socket.user = user;
				socket.tenantSlug = tenantSlug;

				next();
			} catch (error: any) {
				console.error('[WS] Socket authentication error:', error);
				next(new Error('Authentication failed'));
			}
		});
	}

	private setupEventHandlers() {
		if (!this.io) return;

		this.io.on('connection', (socket: AuthSocket) => {
			const { role, _id, name } = socket.user || {};
			const tenantSlug = socket.tenantSlug;

			// Roles administrativos y empleados tienen acceso al POS
			const isStaff = role === Role.admin || role === Role.employee;

			if (isStaff && tenantSlug) {
				this.connectedAdmins.set(socket.id, socket);
				socket.join(`admins_${tenantSlug}`);
				socket.join(`pos_${tenantSlug}`);
				console.log(`🟢 Staff connected to tenant [${tenantSlug}]: ${name} (${socket.id}) [Role: ${role}]`);
			}

			if (role === Role.user && tenantSlug) {
				this.connectedClients.set(socket.id, socket);
				socket.join(`client_${_id}`);
				console.log(`🟢 Client connected to tenant [${tenantSlug}]: ${name} (${socket.id})`);
			}

			// === TERMINAL POS ROOMS (Terminal Web se asocia a una caja específica) ===
			socket.on('pos:join_terminal', (data: { terminalId: string }) => {
				if (!tenantSlug || !data?.terminalId) return;
				const cleanTerminal = String(data.terminalId).trim().toLowerCase();
				const roomName = `terminal_${tenantSlug}_${cleanTerminal}`;
				socket.join(roomName);
				console.log(`🖥️ POS Terminal joined room [${roomName}] from socket ${socket.id}`);

				// Emitir estado actual de escáneres vinculados a esta terminal
				const terminalScanners = this.getActiveScanners(tenantSlug, cleanTerminal);
				socket.emit('pos:scanner_status', {
					connected: terminalScanners.length > 0,
					scannersCount: terminalScanners.length,
					scanners: terminalScanners,
					terminalId: cleanTerminal
				});
			});

			socket.on('pos:leave_terminal', (data: { terminalId: string }) => {
				if (!tenantSlug || !data?.terminalId) return;
				const cleanTerminal = String(data.terminalId).trim().toLowerCase();
				socket.leave(`terminal_${tenantSlug}_${cleanTerminal}`);
			});

			// === MODO ESCÁNER MÓVIL (Android entra en modo pistola remota) ===
			socket.on(
				'pos:scanner_join',
				(data: { terminalId?: string; deviceId?: string; deviceName?: string }, callback?: Function) => {
					if (!tenantSlug) {
						if (typeof callback === 'function') callback({ success: false, message: 'Tenant no identificado' });
						return;
					}

					const deviceId = data?.deviceId || socket.id;
					const deviceName = data?.deviceName || (name ? `Celular de ${name}` : 'Dispositivo Móvil');
					const terminalId = data?.terminalId ? String(data.terminalId).trim().toLowerCase() : undefined;

					socket.isScanner = true;
					socket.scannerDeviceId = deviceId;
					socket.scannerTerminalId = terminalId;

					if (terminalId) {
						socket.join(`terminal_${tenantSlug}_${terminalId}`);
					}

					const scannerInfo: ActiveScannerInfo = {
						socketId: socket.id,
						userId: _id ? String(_id) : socket.id,
						userName: name || 'Operador Móvil',
						tenantSlug,
						deviceId,
						deviceName,
						terminalId,
						connectedAt: new Date()
					};

					this.activeScanners.set(socket.id, scannerInfo);

					console.log(`📱 [Scanner Mode ON] ${deviceName} (${deviceId}) paired with [${terminalId || 'GLOBAL'}] on tenant [${tenantSlug}]`);

					// Notificar a los terminales POS web
					this.notifyScannerStatus(tenantSlug, terminalId);

					if (typeof callback === 'function') {
						callback({
							success: true,
							message: 'Modo escáner activado correctamente',
							scanner: scannerInfo
						});
					}
				}
			);

			socket.on('pos:scanner_leave', (callback?: Function) => {
				const info = this.activeScanners.get(socket.id);
				if (info) {
					this.activeScanners.delete(socket.id);
					socket.isScanner = false;
					if (info.terminalId) {
						socket.leave(`terminal_${tenantSlug}_${info.terminalId}`);
					}
					this.notifyScannerStatus(info.tenantSlug, info.terminalId);
					console.log(`📱 [Scanner Mode OFF] ${info.deviceName} disconnected from scanner mode`);
				}
				if (typeof callback === 'function') {
					callback({ success: true, message: 'Modo escáner desactivado' });
				}
			});

			// === POS REMOTE SCANNER (Disparo de lectura de código de barras) ===
			socket.on(
				'pos:scan_barcode',
				async (data: ScanBarcodePayload, callback?: (response: ScanBarcodeAckResponse) => void) => {
					if (!tenantSlug || !data?.barcode) {
						if (typeof callback === 'function') {
							callback({
								success: false,
								found: false,
								barcode: '',
								message: 'Código de barras requerido',
								product: null,
								matchedVariant: null
							});
						}
						return;
					}

					const cleanBarcode = String(data.barcode).trim();
					const terminalId = data.terminalId ? String(data.terminalId).trim().toLowerCase() : socket.scannerTerminalId;
					const deviceId = data.deviceId || socket.scannerDeviceId || socket.id;
					const deviceName = data.deviceName || (name ? `Celular de ${name}` : 'Lector Móvil');
					const quantity = data.quantity && data.quantity > 0 ? Number(data.quantity) : 1;

					console.log(`📷 [POS Scan] Barcode: ${cleanBarcode} | Terminal: ${terminalId || 'GLOBAL'} | From: ${deviceName}`);

					// Actualizar timestamp del escáner activo
					const scanner = this.activeScanners.get(socket.id);
					if (scanner) {
						scanner.lastScanAt = new Date();
					}

					// 1. Resolver el producto en MongoDB para alimentar tanto el POS como el celular
					let foundResult: any = null;
					try {
						const tenant = await connectionManager.getTenantBySlug(tenantSlug);
						if (tenant) {
							const tenantDb = connectionManager.getTenantDb(tenant.dbName);
							const models = getModelsForConnection(tenantDb);
							const { ProductService } = await import('@/services/product.service');
							foundResult = await ProductService.findByBarcode(models, cleanBarcode);
						}
					} catch (err: any) {
						// Si no existe (404), no interrumpe el flujo
						foundResult = null;
					}

					// 2. Construir payload enriquecido para los mostradores POS web
					const eventPayload = {
						barcode: cleanBarcode,
						product: foundResult?.product || null,
						matchedVariant: foundResult?.matchedVariant || null,
						quantity,
						scannedBy: name || 'Dispositivo Móvil',
						deviceId,
						deviceName,
						terminalId: terminalId || null,
						timestamp: new Date().toISOString()
					};

					// 3. Emitir a la terminal específica (si fue provista) o a todos los admins/POS del tenant
					if (terminalId) {
						this.io?.to(`terminal_${tenantSlug}_${terminalId}`).emit('pos:barcode_scanned', eventPayload);
						// También a admins para monitoreo en vivo
						this.io?.to(`admins_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
					} else {
						this.io?.to(`pos_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
						this.io?.to(`admins_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
					}

					// 4. Responder al celular mediante ACK callback para feedback háptico/sonoro y visual inmediato
					if (typeof callback === 'function') {
						callback({
							success: true,
							found: !!foundResult,
							barcode: cleanBarcode,
							message: foundResult
								? `Producto encontrado: ${foundResult.product.model}`
								: 'Código transmitido al mostrador (producto no registrado)',
							product: foundResult?.product
								? {
										_id: foundResult.product._id?.toString(),
										model: foundResult.product.model,
										brand: foundResult.product.brand,
										category: foundResult.product.category,
										price: foundResult.product.price,
										images: foundResult.product.images || [],
										barcode: foundResult.product.barcode
								  }
								: null,
							matchedVariant: foundResult?.matchedVariant
								? {
										_id: foundResult.matchedVariant._id?.toString(),
										sku: foundResult.matchedVariant.sku,
										barcode: foundResult.matchedVariant.barcode,
										stock: foundResult.matchedVariant.stock,
										size: foundResult.matchedVariant.size,
										color: foundResult.matchedVariant.color,
										price: foundResult.matchedVariant.price
								  }
								: null
						});
					}
				}
			);

			// Desconexión
			socket.on('disconnect', () => {
				if (isStaff) {
					this.connectedAdmins.delete(socket.id);
					console.log(`🔴 Staff disconnected: ${name} (${socket.id})`);
				}
				if (role === Role.user) {
					this.connectedClients.delete(socket.id);
					console.log(`🔴 Client disconnected: ${name} (${socket.id})`);
				}

				// Limpiar de escáneres activos si era un escáner
				const scanner = this.activeScanners.get(socket.id);
				if (scanner) {
					this.activeScanners.delete(socket.id);
					this.notifyScannerStatus(scanner.tenantSlug, scanner.terminalId);
					console.log(`📱 [Scanner Disconnected] ${scanner.deviceName}`);
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

	// === NOTIFICACIÓN DE ESTADO DE ESCÁNERES ===

	private notifyScannerStatus(tenantSlug: string, terminalId?: string) {
		if (!this.io || !tenantSlug) return;

		const terminalScanners = this.getActiveScanners(tenantSlug, terminalId);
		const payload = {
			connected: terminalScanners.length > 0,
			scannersCount: terminalScanners.length,
			scanners: terminalScanners,
			terminalId: terminalId || null,
			timestamp: new Date().toISOString()
		};

		if (terminalId) {
			this.io.to(`terminal_${tenantSlug}_${terminalId}`).emit('pos:scanner_status', payload);
		}
		this.io.to(`pos_${tenantSlug}`).emit('pos:scanner_status', payload);
		this.io.to(`admins_${tenantSlug}`).emit('pos:scanner_status', payload);
	}

	/**
	 * Retorna la lista de escáneres móviles activos para un tenant y opcionalmente una terminal
	 */
	getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		const cleanSlug = tenantSlug.trim().toLowerCase();
		const list: ActiveScannerInfo[] = [];

		for (const scanner of this.activeScanners.values()) {
			if (scanner.tenantSlug === cleanSlug) {
				if (!terminalId || scanner.terminalId === terminalId.trim().toLowerCase()) {
					list.push(scanner);
				}
			}
		}

		return list;
	}

	// === POS BARCODE BROADCAST MANUAL / REST ===

	/**
	 * Emite un código de barras escaneado (usado por el fallback REST POST /api/pos/scan)
	 */
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
	) {
		if (!this.io || !tenantSlug) return;

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
			this.io.to(`terminal_${tenantSlug}_${scanData.terminalId.trim().toLowerCase()}`).emit('pos:barcode_scanned', eventPayload);
			this.io.to(`admins_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
		} else {
			this.io.to(`pos_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
			this.io.to(`admins_${tenantSlug}`).emit('pos:barcode_scanned', eventPayload);
		}
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
			message: `Orden #${order.orderNumber || order._id} creada por valor de $${order.finance.total}`,
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
	 * Notifica a los admins que un cliente subió un comprobante de pago
	 */
	notifyReceiptUploadedToAdmins(tenantSlug: string, order: any) {
		if (!this.io || !tenantSlug) return;

		const notification: CreateAdminNotificationDto = {
			type: NotificationType.ORDER_STATUS_CHANGED,
			title: '🧾 Comprobante de Pago Cargado',
			message: `El cliente cargó un comprobante de pago para la orden #${order.orderNumber || order._id}.`,
			severity: NotificationSeverity.INFO,
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
	 * Notifica a un cliente específico (Versión Sanitizada) y guarda en BD si se pasa models.
	 */
	async notifyClient(userId: string, notificationPayload: CreateClientNotificationDto, models?: TenantModels) {
		if (!this.io) return;

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
		} as INotification;

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
