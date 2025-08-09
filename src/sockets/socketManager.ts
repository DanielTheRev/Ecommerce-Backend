import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { Socket, Server as SocketIOServer } from 'socket.io';
import { AdminUsers } from '../models/AdminUser';
import { User } from '../models/User';

interface AuthSocket extends Socket {
	user?: any;
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
						? ['https://recognised-norwegian-quiz-lightbox.trycloudflare.com']
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
				const token = socket.handshake.auth.token;
				if (!token) return next(new Error('No token provided'));

				const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
					userID: string;
					role: string;
				};

				let user: any;
				const AdminUser = await AdminUsers.findById(decoded.userID).select('name email role');
				const ClientUser = await User.findById(decoded.userID).select('name email role');

				user = AdminUser ? AdminUser : ClientUser;

				if (!user) return next(new Error('User not found'));
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

			if (role === 'admin') {
				this.connectedAdmins.set(socket.id, socket);
				socket.join('admins');
				console.log(`🟢 Admin connected: ${name} (${socket.id})`);
			}

			if (role === 'user') {
				this.connectedClients.set(socket.id, socket);
				socket.join(`client_${_id}`);
				console.log(`🟢 Client connected: ${name} (${socket.id}) role: (${role})`);
			}

			socket.on('disconnect', () => {
				if (role === 'admin') {
					this.connectedAdmins.delete(socket.id);
					console.log(`🔴 Admin disconnected: ${name} (${socket.id})`);
				}
				if (role === 'client') {
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
	notifyAdmins(type: string, data: any) {
		if (!this.io) return;
		this.io.to('admins').emit('admin-notification', this.buildNotification(type, data));
	}

	// A un cliente específico
	notifyClient(userId: string, type: string, data: any) {
		if (!this.io) return;
		this.io
			.to(`client_${userId}`)
			.emit('client-notification', this.buildNotification(type, data));
	}

	// A todos los clientes
	notifyAllClients(type: string, data: any) {
		if (!this.io) return;
		for (const socket of this.connectedClients.values()) {
			socket.emit('client-notification', this.buildNotification(type, data));
		}
	}

	// Helper para generar notificación
	private buildNotification(type: string, data: any) {
		return {
			type,
			data,
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
