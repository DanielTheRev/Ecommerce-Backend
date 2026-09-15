import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection } from '@/config/modelRegistry';
import { ITenant, TenantBusinessType, TenantPlan, TenantSubscriptionStatus } from '@/interfaces/tenant.interface';
import { Role } from '@/interfaces/user.interface';
import { AppError } from '@/errors/app.error';
import slugify from 'slugify';

export interface CreateTenantDTO {
	name: string;
	slug?: string;
	businessType?: TenantBusinessType;
	plan?: TenantPlan;
	domain?: string;
	ownerName?: string;
	ownerEmail: string;
	ownerPhone?: string;
	adminPassword?: string;
	primaryColor?: string;
}

export class MasterTenantService {
	/**
	 * Listar todos los comercios registrados en la base maestra de VEX.
	 */
	static async listTenants(): Promise<any[]> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenants = await TenantModel.find().sort({ createdAt: -1 }).lean();

		// Enriquecer con métricas de base de datos de cada tenant (conteos)
		const enriched = await Promise.all(
			tenants.map(async (t) => {
				let productsCount = 0;
				let usersCount = 0;
				try {
					const tenantDb = connectionManager.getTenantDb(t.dbName);
					const models = getModelsForConnection(tenantDb);
					productsCount = await models.Product.countDocuments();
					usersCount = await models.User.countDocuments();
				} catch (err) {
					// Si la DB aún no tiene colecciones o no conectó, se mantiene en 0
				}

				return {
					...t,
					metrics: {
						productsCount,
						usersCount
					}
				};
			})
		);

		return enriched;
	}

	/**
	 * Crear un nuevo comercio en la plataforma VEX y aprovisionar su base de datos.
	 */
	static async createTenant(dto: CreateTenantDTO): Promise<{ tenant: ITenant; adminUser: any }> {
		if (!dto.name || !dto.ownerEmail) {
			throw new AppError('Validation Error', 'El nombre del negocio y el email del dueño son obligatorios.', 400);
		}

		const cleanSlug = slugify(dto.slug || dto.name, { lower: true, strict: true });
		const dbName = `${cleanSlug.replace(/-/g, '_')}_db`;

		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		// Validar que no exista el slug
		const existing = await TenantModel.findOne({ slug: cleanSlug });
		if (existing) {
			throw new AppError('Tenant Conflict', `Ya existe un comercio con el identificador "${cleanSlug}".`, 409);
		}

		const plan = dto.plan || TenantPlan.basic;
		const businessType: TenantBusinessType = dto.businessType || 'general';

		// 1. Crear documento Tenant en MasterDb
		const tenant = await TenantModel.create({
			name: dto.name.trim(),
			slug: cleanSlug,
			dbName,
			businessType,
			domain: dto.domain ? dto.domain.trim().toLowerCase() : undefined,
			plan,
			isActive: true,
			subscriptionStatus: 'active',
			ownerContact: {
				email: dto.ownerEmail.trim().toLowerCase(),
				name: dto.ownerName ? dto.ownerName.trim() : dto.name.trim(),
				phone: dto.ownerPhone ? dto.ownerPhone.trim() : undefined
			},
			commission: {
				percentage: plan === TenantPlan.premium ? 5 : 10,
				fixedFee: 0
			},
			settings: {
				primaryColor: dto.primaryColor || '#0D0D0D',
				allowedOrigins: [
					'http://localhost:4200',
					'http://localhost:4300',
					'http://localhost:3000'
				]
			}
		});

		// 2. Aprovisionar DB del nuevo tenant y crear usuario Admin inicial
		const tenantDb = connectionManager.getTenantDb(dbName);
		const models = getModelsForConnection(tenantDb);

		const passwordToUse = dto.adminPassword && dto.adminPassword.length >= 6 ? dto.adminPassword : 'VexAdmin2026!';

		const adminUser = await models.User.create({
			name: dto.ownerName || dto.name,
			email: dto.ownerEmail.trim().toLowerCase(),
			password: passwordToUse,
			role: Role.admin,
			isActive: true
		});

		// 3. Crear configuración base de la tienda
		await models.EcommerceConfig.create({
			key: 'global_config',
			name: dto.name.trim()
		});

		return {
			tenant: tenant.toObject(),
			adminUser: {
				_id: adminUser._id,
				name: adminUser.name,
				email: adminUser.email,
				role: adminUser.role,
				temporaryPassword: passwordToUse
			}
		};
	}

	/**
	 * Activar o pausar inmediatamente el acceso de un comercio (Kill Switch).
	 */
	static async toggleTenantStatus(tenantId: string, isActive: boolean): Promise<ITenant> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenant = await TenantModel.findByIdAndUpdate(
			tenantId,
			{ $set: { isActive } },
			{ new: true }
		);

		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		return tenant.toObject();
	}

	/**
	 * Actualizar el estado de suscripción y facturación del comercio.
	 */
	static async updateSubscriptionStatus(
		tenantId: string,
		subscriptionStatus: TenantSubscriptionStatus
	): Promise<ITenant> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenant = await TenantModel.findByIdAndUpdate(
			tenantId,
			{ $set: { subscriptionStatus } },
			{ new: true }
		);

		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		return tenant.toObject();
	}

	/**
	 * Actualizar plan contratado.
	 */
	static async updateTenantPlan(tenantId: string, plan: TenantPlan): Promise<ITenant> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenant = await TenantModel.findByIdAndUpdate(
			tenantId,
			{ $set: { plan } },
			{ new: true }
		);

		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		return tenant.toObject();
	}
}
