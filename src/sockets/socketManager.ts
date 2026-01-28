import { IUser, Role } from '@/interfaces/user.interface';
import { UserService } from '@/services/user.service';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { parse } from 'cookie';

interface AuthSocket extends Socket {
	user?: IUser;
}

class SocketManager {
	private io: SocketIOServer | null = null;
	private connectedAdmins: Map<string, AuthSocket> = new Map();
	private connectedClients: Map<string, AuthSocket> = new Map();

	initialize(server: HTTPServer) {
		this.io = new SocketIOServer(server, {
			cors: {
				origin:
					process.env.NODE_ENV === 'production'
						? ['https://www.electromix.com.ar']
						: [
								'http://localhost:3000',
								'http://localhost:3001',
								'http://localhost:5173',
								'http://localhost:4200',
								'http://localhost:4300',
								'http://localhost:4000'
							],
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
			// console.log('alguien se quiere conectar...');
			try {
				const cookies = socket.handshake.headers.cookie;

				if (!cookies) return next(new Error('No cookies'));
				const parsed = parse(cookies);
				const token = parsed['token_b'];
				if (!token) return next(new Error('No token provided'));

				const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
					userID: string;
				};

				const user = await UserService.getUserByID(decoded.userID);
				socket.user = user;

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

			if (role === Role.admin) {
				this.connectedAdmins.set(socket.id, socket);
				socket.join('admins');
				console.log(`🟢 Admin connected: ${name} (${socket.id})`);
			}

			if (role === Role.user) {
				this.connectedClients.set(socket.id, socket);
				socket.join(`client_${_id}`);
				console.log(`🟢 Client connected: ${name} (${socket.id}) role: (${role})`);
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
				timestamp: new Date().toISOString()
			});
		});
	}

	// === NOTIFICACIONES ===

	// A todos los admins
	notifyAdmins(type: 'new_order', message: string, data: any) {
		if (!this.io) return;
		this.io.to('admins').emit('admin-notification', this.buildNotification(type, message, data));
	}

	notifyOrderStateToAdmin(type: string, Data: any, message: string) {
		if (!this.io) return;
		const notification = this.buildNotification(type, message, Data);
		this.io.to('admins').emit('order-notification', notification);
	}

	// A un cliente específico
	notifyClient(userId: string, message: string, type: string, data: any) {
		if (!this.io) return;
		this.io
			.to(`client_${userId}`)
			.emit('client-notification', this.buildNotification(type, message, data));
	}

	// A todos los clientes
	notifyAllClients(type: string, message: string, data: any) {
		if (!this.io) return;
		for (const socket of this.connectedClients.values()) {
			socket.emit('client-notification', this.buildNotification(type, message, data));
		}
	}

	// Helper para generar notificación
	private buildNotification(type: string, message: string, data: any) {
		return {
			type,
			data,
			message,
			timestamp: new Date().toISOString(),
			id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
		};
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
