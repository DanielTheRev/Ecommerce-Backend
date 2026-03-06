import mongoose, { Connection } from 'mongoose';
import { TenantSchema } from '@/models/Tenant.model';
import { ITenant } from '@/interfaces/tenant.interface';

/**
 * ConnectionManager - Gestiona la conexión base a MongoDB
 * y las conexiones a las bases de datos de cada tenant.
 *
 * Usa `useDb()` para switchear entre DBs sin crear múltiples conexiones TCP.
 * Mongoose cachea las conexiones useDb internamente.
 */
class ConnectionManager {
	private baseConnection: Connection | null = null;
	private masterDb: Connection | null = null;

	/**
	 * Inicializa la conexión base a MongoDB.
	 * Se llama una sola vez al arrancar el servidor.
	 */
	async connect(): Promise<void> {
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

		this.baseConnection = await mongoose.createConnection(mongoURI).asPromise();
		this.masterDb = this.baseConnection.useDb('master_db', { useCache: true });

		// Registrar modelo Tenant en master_db
		this.masterDb.model<ITenant>('Tenant', TenantSchema);

		console.log('✅ MongoDB conectado exitosamente (Multi-Tenant)');
		console.log('📊 Master DB: master_db');

		// Event listeners
		this.baseConnection.on('error', (error) => {
			console.error('❌ Error de conexión a MongoDB:', error);
		});

		this.baseConnection.on('disconnected', () => {
			console.log('⚠️ MongoDB desconectado');
		});

		// Graceful shutdown
		process.on('SIGINT', async () => {
			if (this.baseConnection) {
				await this.baseConnection.close();
				console.log('🔒 Conexión a MongoDB cerrada');
			}
			process.exit(0);
		});
	}

	/**
	 * Obtiene la conexión a la master_db (donde viven los tenants).
	 */
	getMasterDb(): Connection {
		if (!this.masterDb) {
			throw new Error('ConnectionManager no inicializado. Llamar a connect() primero.');
		}
		return this.masterDb;
	}

	/**
	 * Obtiene una conexión a la DB de un tenant específico.
	 * Usa useDb con cache, así que no crea conexiones nuevas en cada request.
	 */
	getTenantDb(dbName: string): Connection {
		if (!this.baseConnection) {
			throw new Error('ConnectionManager no inicializado. Llamar a connect() primero.');
		}
		return this.baseConnection.useDb(dbName, { useCache: true });
	}

	/**
	 * Busca un tenant por slug en la master_db.
	 */
	async getTenantBySlug(slug: string): Promise<ITenant | null> {
		const masterDb = this.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		return TenantModel.findOne({ slug, isActive: true }).lean() as Promise<ITenant | null>;
	}

	/**
	 * Busca un tenant por dominio (para resolución por subdominio/dominio).
	 */
	async getTenantByDomain(domain: string): Promise<ITenant | null> {
		const masterDb = this.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		return TenantModel.findOne({ domain, isActive: true }).lean() as Promise<ITenant | null>;
	}

	/**
	 * Cierra la conexión base.
	 */
	async disconnect(): Promise<void> {
		if (this.baseConnection) {
			await this.baseConnection.close();
			this.baseConnection = null;
			this.masterDb = null;
		}
	}
}

// Singleton
export const connectionManager = new ConnectionManager();
