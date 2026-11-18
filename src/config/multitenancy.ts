import mongoose, { Connection, Model } from 'mongoose';
import { TenantSchema } from '@/models/Tenant.model';
import { IStoreOwner, StoreOwnerSchema } from '@/models/StoreOwner.model';
import { ITenant } from '@/interfaces/tenant.interface';
import { escapeRegex } from '@/utils/regex.util';

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
	private connectPromise: Promise<void> | null = null;

	/**
	 * Inicializa la conexión base a MongoDB.
	 * En entorno serverless (Vercel) o monolítico, reutiliza la conexión si ya está activa.
	 */
	async connect(): Promise<void> {
		if (this.baseConnection && this.baseConnection.readyState === 1 && this.masterDb) {
			return;
		}

		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = (async () => {
			const mongoURI = process.env.MONGODB_URI;
			if (!mongoURI) {
				throw new Error('FATAL: Falta la variable MONGODB_URI en el archivo de entorno.');
			}

			this.baseConnection = await mongoose.createConnection(mongoURI, {
				maxPoolSize: process.env.MONGODB_MAX_POOL_SIZE ? parseInt(process.env.MONGODB_MAX_POOL_SIZE, 10) : 10,
				minPoolSize: 0,
				maxIdleTimeMS: 30000,
				serverSelectionTimeoutMS: 5000,
				socketTimeoutMS: 45000,
			}).asPromise();
			this.masterDb = this.baseConnection.useDb('master_db', { useCache: true });

			// Registrar modelo Tenant, MasterProduct, StorefrontTemplate y MasterOperator en master_db
			this.masterDb.model<ITenant>('Tenant', TenantSchema);
			if (!this.masterDb.models.MasterProduct) {
				const { MasterProductSchema } = await import('@/models/MasterProduct.model');
				this.masterDb.model('MasterProduct', MasterProductSchema);
			}
			if (!this.masterDb.models.StorefrontTemplate) {
				const { StorefrontTemplateSchema } = await import('@/models/StorefrontTemplate.model');
				this.masterDb.model('StorefrontTemplate', StorefrontTemplateSchema);
			}
			if (!this.masterDb.models.MasterOperator) {
				const { MasterOperatorSchema } = await import('@/models/MasterOperator.model');
				this.masterDb.model('MasterOperator', MasterOperatorSchema);
			}
			if (!this.masterDb.models.StoreOwner) {
				this.masterDb.model<IStoreOwner>('StoreOwner', StoreOwnerSchema);
			}

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
		})();

		try {
			await this.connectPromise;
		} finally {
			this.connectPromise = null;
		}
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
	 * Obtiene el modelo StoreOwner en master_db.
	 */
	getStoreOwnerModel(): Model<IStoreOwner> {
		const masterDb = this.getMasterDb();
		if (!masterDb.models.StoreOwner) {
			return masterDb.model<IStoreOwner>('StoreOwner', StoreOwnerSchema);
		}
		return masterDb.models.StoreOwner as Model<IStoreOwner>;
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

	private tenantSlugCache = new Map<string, ITenant>();
	private tenantDomainCache = new Map<string, ITenant>();
	private tenantApiKeyCache = new Map<string, ITenant>();

	async getTenantBySlug(slug: string): Promise<ITenant | null> {
		const cleanSlug = (slug || '').trim().toLowerCase();
		if (!cleanSlug) return null;

		const cached = this.tenantSlugCache.get(cleanSlug);
		if (cached) return cached;

		const masterDb = this.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenant = await TenantModel.findOne({
			$or: [
				{ slug: cleanSlug },
				{ slug: slug },
				{ slug: { $regex: new RegExp(`^${escapeRegex(cleanSlug)}$`, 'i') } }
			],
			isActive: true
		}).lean() as ITenant | null;

		if (tenant) {
			this.tenantSlugCache.set(cleanSlug, tenant);
		}
		return tenant;
	}

	/**
	 * Busca un tenant por su Nombre Comercial exacto (case-insensitive) o por slug.
	 * Permite que el dueño o empleado ingrese el nombre de su comercio en el login sin exponer el slug técnico.
	 */
	async getTenantByIdentifier(identifier: string): Promise<ITenant | null> {
		const raw = (identifier || '').trim();
		if (!raw) return null;
		const clean = raw.toLowerCase();

		const cached = this.tenantSlugCache.get(clean);
		if (cached) return cached;

		const masterDb = this.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const escaped = escapeRegex(raw);
		const tenant = (await TenantModel.findOne({
			$or: [
				{ name: { $regex: new RegExp(`^${escaped}$`, 'i') } },
				{ slug: clean }
			],
			isActive: true
		}).lean()) as ITenant | null;

		if (tenant) {
			this.tenantSlugCache.set(clean, tenant);
			this.tenantSlugCache.set(tenant.slug.toLowerCase(), tenant);
		}
		return tenant;
	}

	/**
	 * Busca un tenant por Storefront API Key (ej. pk_live_...)
	 */
	async getTenantByApiKey(apiKey: string): Promise<ITenant | null> {
		const cleanApiKey = (apiKey || '').trim();
		if (!cleanApiKey) return null;

		const cached = this.tenantApiKeyCache.get(cleanApiKey);
		if (cached) return cached;

		const masterDb = this.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenant = await TenantModel.findOne({ apiKey: cleanApiKey, isActive: true }).lean() as ITenant | null;

		if (tenant) {
			this.tenantApiKeyCache.set(cleanApiKey, tenant);
		}
		return tenant;
	}

	/**
	 * Busca un tenant por dominio o subdominio de plataforma (ej. mikioko.vexx.com.ar o www.vuraclothing.com).
	 */
	async getTenantByDomain(domain: string): Promise<ITenant | null> {
		const cleanDomain = (domain || '')
			.trim()
			.toLowerCase()
			.replace(/^https?:\/\//, '')
			.replace(/\/.*$/, '')
			.replace(/:\d+$/, '');
		if (!cleanDomain) return null;

		const cached = this.tenantDomainCache.get(cleanDomain);
		if (cached) return cached;

		// 1. Si es subdominio de la plataforma (*.vexx.com.ar), resolver por slug
		const baseDomain = (process.env.VEXX_BASE_DOMAIN || 'vexx.com.ar').trim().toLowerCase();
		if (cleanDomain.endsWith(`.${baseDomain}`)) {
			const prefix = cleanDomain.slice(0, -(baseDomain.length + 1)).replace(/^www\./, '');
			const reservedSubdomains = new Set(['', 'www', 'api', 'panel', 'console', 'admin', 'mail', 'cdn', 'static']);
			if (prefix && !prefix.includes('.') && !reservedSubdomains.has(prefix)) {
				const tenantBySubdomain = await this.getTenantBySlug(prefix);
				if (tenantBySubdomain) {
					this.tenantDomainCache.set(cleanDomain, tenantBySubdomain);
					return tenantBySubdomain;
				}
			}
		}

		// 2. Resolver por dominio propio (custom domain, con o sin www.)
		const bareDomain = cleanDomain.replace(/^www\./, '');
		const wwwDomain = `www.${bareDomain}`;

		const masterDb = this.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenant = await TenantModel.findOne({
			$or: [
				{ domain: cleanDomain },
				{ domain: bareDomain },
				{ domain: wwwDomain },
				{ domain: `https://${bareDomain}` },
				{ domain: `https://${wwwDomain}` },
				{ domain: `http://${bareDomain}` },
				{ domain: { $regex: new RegExp(`^(https?://)?(www\\.)?${escapeRegex(bareDomain)}/?$`, 'i') } }
			],
			isActive: true
		}).lean() as ITenant | null;

		if (tenant) {
			this.tenantDomainCache.set(cleanDomain, tenant);
		}
		return tenant;
	}

	/**
	 * Invalida el caché de tenants si se crea o modifica uno.
	 */
	invalidateTenantCache(slugOrDomainOrKey?: string): void {
		if (slugOrDomainOrKey) {
			const clean = slugOrDomainOrKey.trim().toLowerCase();
			this.tenantSlugCache.delete(clean);
			this.tenantDomainCache.delete(clean);
			this.tenantApiKeyCache.delete(slugOrDomainOrKey.trim());
		} else {
			this.tenantSlugCache.clear();
			this.tenantDomainCache.clear();
			this.tenantApiKeyCache.clear();
		}
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
