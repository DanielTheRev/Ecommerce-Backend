import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { isOriginAllowed } from '@/config/cors';
import { Role } from '@/interfaces/user.interface';
import { socketAuthMiddleware } from './socketAuth.middleware';
import { ScannerSocketHandler } from './scannerSocket.handler';
import { ActiveScannerInfo, AuthSocket } from './socket.types';

export type { ActiveScannerInfo, ScanBarcodePayload, ScanBarcodeAckResponse } from './socket.types';

/**
 * Gateway puro de Socket.IO (SRP).
 * Gestiona ciclo de vida del servidor WS, salas multi-tenant y emisión de eventos.
 * La lógica de negocio de notificaciones reside en SocketRealtimeService.
 */
class SocketManager {
	private io: SocketIOServer | null = null;
	private connectedAdmins: Map<string, AuthSocket> = new Map();
	private connectedClients: Map<string, AuthSocket> = new Map();
	private scannerHandler = new ScannerSocketHandler();

	public get isInitialized(): boolean {
		return !!this.io;
	}

	public get ioServer(): SocketIOServer | null {
		return this.io;
	}

	initialize(server: HTTPServer): void {
		this.io = new SocketIOServer(server, {
			cors: {
				origin: (origin, callback) => {
					if (isOriginAllowed(origin)) {
						callback(null, true);
					} else {
						callback(new Error('CORS not allowed for Socket.IO origin'));
					}
				},
				credentials: true
			},
			path: '/api/socket.io',
			transports: ['websocket', 'polling']
		});

		this.io.use(socketAuthMiddleware);
		this.setupConnectionHandlers();

		console.log('🔌 WebSocket Server initialized (Socket.IO)');
	}

	private setupConnectionHandlers(): void {
		if (!this.io) return;

		this.io.on('connection', (socket: AuthSocket) => {
			const { role, _id, name } = socket.user || {};
			const tenantSlug = socket.tenantSlug;
			const isStaff = role === Role.admin || role === Role.employee;

			if (isStaff && tenantSlug) {
				this.connectedAdmins.set(socket.id, socket);
				socket.join(`admins_${tenantSlug}`);
				socket.join(`pos_${tenantSlug}`);
				console.log(`🟢 Staff connected to tenant [${tenantSlug}]: ${name} (${socket.id}) [Role: ${role}]`);
			}

			if (role === Role.user && tenantSlug) {
				this.connectedClients.set(socket.id, socket);
				socket.join(`client_${tenantSlug}_${_id}`);
				socket.join(`client_${_id}`);
				socket.join(`clients_${tenantSlug}`);
				console.log(`🟢 Client connected to tenant [${tenantSlug}]: ${name} (${socket.id})`);
			}

			this.scannerHandler.registerHandlers(this.io!, socket);

			socket.on('disconnect', () => {
				if (isStaff) {
					this.connectedAdmins.delete(socket.id);
					console.log(`🔴 Staff disconnected: ${name} (${socket.id})`);
				}
				if (role === Role.user) {
					this.connectedClients.delete(socket.id);
					console.log(`🔴 Client disconnected: ${name} (${socket.id})`);
				}
				if (this.io) {
					this.scannerHandler.handleDisconnect(this.io, socket);
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

	public emitToAdmins(tenantSlug: string, event: string, payload: any): void {
		if (!this.io) return;
		const room = tenantSlug ? `admins_${tenantSlug}` : 'admins';
		this.io.to(room).emit(event, payload);
	}

	public emitToClient(tenantSlug: string, userId: string, event: string, payload: any): void {
		if (!this.io) return;
		if (tenantSlug) {
			this.io.to(`client_${tenantSlug}_${userId}`).emit(event, payload);
		}
		this.io.to(`client_${userId}`).emit(event, payload);
	}

	public emitToAllClients(tenantSlug: string, event: string, payload: any): void {
		if (!this.io) return;
		if (tenantSlug) {
			this.io.to(`clients_${tenantSlug}`).emit(event, payload);
			return;
		}
		for (const socket of this.connectedClients.values()) {
			socket.emit(event, payload);
		}
	}

	public broadcastScannedBarcode(
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

		this.scannerHandler.emitBarcodeScanned(this.io, tenantSlug, eventPayload, scanData.terminalId);
	}

	public notifyScannerStatus(tenantSlug: string, terminalId?: string): void {
		if (!this.io || !tenantSlug) return;
		this.scannerHandler.notifyScannerStatus(this.io, tenantSlug, terminalId);
	}

	public getActiveScanners(tenantSlug: string, terminalId?: string): ActiveScannerInfo[] {
		return this.scannerHandler.getActiveScanners(tenantSlug, terminalId);
	}

	public getStats() {
		return {
			connectedAdmins: this.connectedAdmins.size,
			connectedClients: this.connectedClients.size,
			isInitialized: this.io !== null
		};
	}

	public async close(): Promise<void> {
		if (!this.io) return;
		await new Promise<void>((resolve) => {
			this.io!.close(() => resolve());
		});
		this.connectedAdmins.clear();
		this.connectedClients.clear();
		this.io = null;
	}
}

export const socketManager = new SocketManager();
