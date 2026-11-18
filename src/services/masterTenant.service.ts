import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection } from '@/config/modelRegistry';
import { ITenant, TenantBusinessType, TenantPlan, TenantSubscriptionStatus } from '@/interfaces/tenant.interface';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { Role } from '@/interfaces/user.interface';
import { AppError } from '@/errors/app.error';
import { validateActiveAddonsForTenant } from '@/addons/registry';
import { CacheService } from './cache.service';
import { StorefrontTemplateService } from './storefrontTemplate.service';
import { SubscriptionPlanService } from './subscriptionPlan.service';
import { TenantDomainMode } from '@/interfaces/storefrontTemplate.interface';
import slugify from 'slugify';
import crypto from 'crypto';

export interface CreateTenantDTO {
	name: string;
	slug?: string;
	businessType?: TenantBusinessType;
	plan?: TenantPlan;
	planTier?: VexxPlanTier | 'local' | 'point' | 'pro';
	activeAddons?: string[];
	customLabels?: Record<string, string>;
	addonLabels?: Record<string, Record<string, string>>;
	domain?: string;
	domainMode?: TenantDomainMode;
	activeTemplateKey?: string;
	unlockedTemplates?: string[];
	templateSettings?: Record<string, unknown>;
	ownerName?: string;
	ownerEmail: string;
	ownerPhone?: string;
	adminPassword?: string;
	primaryColor?: string;
}

export interface UpdateTenantDTO {
	name?: string;
	domain?: string;
	domainMode?: TenantDomainMode;
	activeTemplateKey?: string;
	unlockedTemplates?: string[];
	templateSettings?: Record<string, unknown>;
	ownerName?: string;
	ownerEmail?: string;
	ownerPhone?: string;
	customLabels?: Record<string, string>;
	addonLabels?: Record<string, Record<string, string>>;
	primaryColor?: string;
	logo?: string;
}

export interface UpdateTenantPlanDTO {
	planTier: VexxPlanTier | string;
	activeAddons?: string[];
	extraEmployeesPurchased?: number;
}

export class MasterTenantService {
	/**
	 * Listar todos los comercios registrados en la base maestra de VEX.
	 */
	static async listTenants(): Promise<any[]> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenants = await TenantModel.find().sort({ createdAt: -1 }).lean();
		const allTemplates = await StorefrontTemplateService.listAllTemplates(true);

		// Enriquecer con métricas de base de datos y configuración de storefront de cada tenant
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

				const storefront = await StorefrontTemplateService.buildTenantStorefrontSummary(
					t as unknown as ITenant,
					allTemplates
				);

				return {
					...t,
					storefront,
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
	 * Obtener un comercio por ID con sus métricas y resumen de storefront.
	 */
	static async getTenantById(tenantId: string): Promise<any> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenant = await TenantModel.findById(tenantId).lean();
		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		let productsCount = 0;
		let usersCount = 0;
		try {
			const tenantDb = connectionManager.getTenantDb(tenant.dbName);
			const models = getModelsForConnection(tenantDb);
			productsCount = await models.Product.countDocuments();
			usersCount = await models.User.countDocuments();
		} catch (err) {}

		const storefront = await StorefrontTemplateService.buildTenantStorefrontSummary(tenant as unknown as ITenant);

		return {
			...tenant,
			storefront,
			metrics: { productsCount, usersCount }
		};
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

		await SubscriptionPlanService.ensureDefaultPlansSeeded();
		const rawPlanCode = dto.planTier ? dto.planTier.trim().toLowerCase() : '';
		const customPlanDoc = rawPlanCode ? SubscriptionPlanService.getCachedPlanOrFallback(rawPlanCode) : undefined;
		if (!rawPlanCode || (!Object.values(VexxPlanTier).includes(rawPlanCode as VexxPlanTier) && !customPlanDoc)) {
			throw new AppError(
				'Validation Error',
				`El plan de suscripción (planTier) es obligatorio. Opciones base: ${Object.values(VexxPlanTier).join(', ')}.`,
				400
			);
		}
		const planTier = rawPlanCode as VexxPlanTier;
		const effectiveBaseTier = customPlanDoc?.baseTier || planTier;
		const plan = dto.plan || (effectiveBaseTier === VexxPlanTier.PRO ? TenantPlan.premium : TenantPlan.basic);
		if (!dto.businessType) {
			throw new AppError('Validation Error', 'El rubro comercial (businessType) es obligatorio.', 400);
		}
		const businessType: TenantBusinessType = dto.businessType;
		if (dto.activeAddons === undefined) {
			throw new AppError(
				'Validation Error',
				'El campo activeAddons es obligatorio al dar de alta un comercio (enviá la lista de complementos seleccionados).',
				400
			);
		}
		const validatedAddons = validateActiveAddonsForTenant(dto.activeAddons);

		const apiKey = `pk_live_${crypto.randomBytes(16).toString('hex')}`;

		const templates = await StorefrontTemplateService.listAllTemplates(true);
		const defaultTpl = StorefrontTemplateService.selectDefaultTemplateForTenant(templates, planTier, businessType);
		const cleanDomain = dto.domain ? StorefrontTemplateService.normalizeCustomDomain(dto.domain) : undefined;
		const resolvedActiveTemplateKey = dto.activeTemplateKey
			? dto.activeTemplateKey.trim().toLowerCase()
			: defaultTpl?.key;
		const resolvedUnlocked = Array.from(
			new Set([
				...(dto.unlockedTemplates || []).map((k) => k.trim().toLowerCase()).filter(Boolean),
				...(resolvedActiveTemplateKey ? [resolvedActiveTemplateKey] : [])
			])
		);

		// 1. Crear documento Tenant en MasterDb
		const tenant = await TenantModel.create({
			name: dto.name.trim(),
			slug: cleanSlug,
			dbName,
			businessType,
			apiKey,
			domain: cleanDomain,
			domainMode: cleanDomain ? (dto.domainMode || 'custom_domain') : 'vexx_subdomain',
			activeTemplateKey: resolvedActiveTemplateKey,
			unlockedTemplates: resolvedUnlocked,
			templateSettings: dto.templateSettings || {},
			plan,
			planTier,
			activeAddons: validatedAddons,
			customLabels: dto.customLabels || {},
			addonLabels: dto.addonLabels || {},
			isActive: true,
			subscriptionStatus: 'active',
			ownerContact: {
				email: dto.ownerEmail.trim().toLowerCase(),
				name: dto.ownerName ? dto.ownerName.trim() : dto.name.trim(),
				phone: dto.ownerPhone ? dto.ownerPhone.trim() : undefined
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

		// 3. Crear configuración base de la tienda (Día Cero Limpio)
		await models.EcommerceConfig.create({
			key: 'global_config',
			name: dto.name.trim(),
			businessType: businessType
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
	 * Actualizar datos generales del comercio.
	 */
	static async updateTenant(tenantId: string, dto: UpdateTenantDTO): Promise<ITenant> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const updatePayload: Record<string, any> = {};
		if (dto.name) updatePayload.name = dto.name.trim();
		if (dto.domain !== undefined) {
			const cleanDom = dto.domain ? StorefrontTemplateService.normalizeCustomDomain(dto.domain) : undefined;
			updatePayload.domain = cleanDom;
			updatePayload.domainMode = cleanDom ? (dto.domainMode || 'custom_domain') : 'vexx_subdomain';
		} else if (dto.domainMode !== undefined) {
			updatePayload.domainMode = dto.domainMode;
		}
		if (dto.activeTemplateKey !== undefined) {
			updatePayload.activeTemplateKey = dto.activeTemplateKey ? dto.activeTemplateKey.trim().toLowerCase() : undefined;
		}
		if (dto.unlockedTemplates !== undefined) {
			updatePayload.unlockedTemplates = dto.unlockedTemplates.map((k) => k.trim().toLowerCase()).filter(Boolean);
		}
		if (dto.templateSettings !== undefined) {
			updatePayload.templateSettings = dto.templateSettings;
		}
		if (dto.ownerEmail || dto.ownerName || dto.ownerPhone) {
			if (dto.ownerEmail) updatePayload['ownerContact.email'] = dto.ownerEmail.trim().toLowerCase();
			if (dto.ownerName) updatePayload['ownerContact.name'] = dto.ownerName.trim();
			if (dto.ownerPhone !== undefined) updatePayload['ownerContact.phone'] = dto.ownerPhone.trim();
		}
		if (dto.customLabels !== undefined) updatePayload.customLabels = dto.customLabels;
		if (dto.addonLabels !== undefined) updatePayload.addonLabels = dto.addonLabels;
		if (dto.primaryColor) updatePayload['settings.primaryColor'] = dto.primaryColor;
		if (dto.logo) updatePayload['settings.logo'] = dto.logo;

		const tenant = await TenantModel.findByIdAndUpdate(
			tenantId,
			{ $set: updatePayload },
			{ new: true }
		);

		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		if (dto.domain !== undefined) {
			connectionManager.invalidateTenantCache();
		}
		this.invalidateTenantCaches(tenant);

		return tenant.toObject();
	}

	/**
	 * Invalida inmediatamente los cachés en memoria del tenant (slug, dominio, apiKey y config pública)
	 * para que cambios de plan, addons o estado impacten en el próximo request sin reiniciar el servidor.
	 */
	private static invalidateTenantCaches(tenant: Pick<ITenant, 'slug' | 'domain' | 'apiKey'>): void {
		connectionManager.invalidateTenantCache(tenant.slug);
		if (tenant.domain) {
			const cleanDomain = tenant.domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
			if (cleanDomain) {
				connectionManager.invalidateTenantCache(cleanDomain);
			}
		}
		if (tenant.apiKey) {
			connectionManager.invalidateTenantCache(tenant.apiKey);
		}
		CacheService.invalidatePrefix(tenant.slug, 'config');
	}

	/**
	 * Actualizar plan modular (planTier), add-ons y empleados extras (Upgrades de venta).
	 */
	static async updateTenantPlanAndAddons(
		tenantId: string,
		planTier: string,
		activeAddons?: string[],
		extraEmployeesPurchased?: number
	): Promise<ITenant> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		await SubscriptionPlanService.ensureDefaultPlansSeeded();
		const normalizedTier = planTier.trim().toLowerCase() as VexxPlanTier;
		const customPlanDoc = SubscriptionPlanService.getCachedPlanOrFallback(normalizedTier);
		if (!Object.values(VexxPlanTier).includes(normalizedTier) && !customPlanDoc) {
			throw new AppError('Invalid Plan Tier', `El plan '${planTier}' no es válido.`, 400);
		}

		const effectiveBaseTier = customPlanDoc?.baseTier || normalizedTier;
		const updatePayload: Record<string, any> = {
			planTier: normalizedTier,
			plan: effectiveBaseTier === VexxPlanTier.PRO ? TenantPlan.premium : TenantPlan.basic
		};

		if (activeAddons !== undefined) {
			updatePayload.activeAddons = validateActiveAddonsForTenant(activeAddons);
		}

		if (typeof extraEmployeesPurchased === 'number' && extraEmployeesPurchased >= 0) {
			updatePayload.extraEmployeesPurchased = extraEmployeesPurchased;
		}

		const tenant = await TenantModel.findByIdAndUpdate(
			tenantId,
			{ $set: updatePayload },
			{ new: true }
		);

		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		this.invalidateTenantCaches(tenant);

		return tenant.toObject();
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

		this.invalidateTenantCaches(tenant);

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

		this.invalidateTenantCaches(tenant);

		return tenant.toObject();
	}

	/**
	 * Modificar el rubro comercial de un tenant (Acción exclusiva de SuperAdmin).
	 * Actualiza tanto el registro en Master DB como la configuración local del comercio.
	 */
	static async updateTenantBusinessType(tenantId: string, newBusinessType: TenantBusinessType): Promise<ITenant> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const validTypes: TenantBusinessType[] = ['kiosk_grocery', 'fashion', 'tech_electronics', 'butcher', 'bakery', 'gastronomy'];
		if (!validTypes.includes(newBusinessType)) {
			throw new AppError('Validation Error', `Rubro '${newBusinessType}' inválido. Válidos: ${validTypes.join(', ')}`, 400);
		}

		const tenant = await TenantModel.findByIdAndUpdate(
			tenantId,
			{ $set: { businessType: newBusinessType } },
			{ new: true }
		);

		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		// Sincronizar en la base de datos local del tenant
		try {
			const tenantDb = connectionManager.getTenantDb(tenant.dbName);
			const models = getModelsForConnection(tenantDb);
			await models.EcommerceConfig.findOneAndUpdate(
				{ key: 'global_config' },
				{ $set: { businessType: newBusinessType } },
				{ new: true, upsert: true }
			);
		} catch (err: any) {
			console.error(`⚠️ Error sincronizando businessType en tenant DB [${tenant.dbName}]:`, err.message);
		}

		this.invalidateTenantCaches(tenant);

		return tenant.toObject();
	}

	/**
	 * Restablecer contraseña del dueño del comercio (Soporte técnico).
	 */
	static async resetOwnerPassword(tenantId: string, newPassword?: string): Promise<{ email: string; temporaryPassword: string }> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenant = await TenantModel.findById(tenantId);
		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		const tenantDb = connectionManager.getTenantDb(tenant.dbName);
		const models = getModelsForConnection(tenantDb);

		const adminUser = await models.User.findOne({ role: Role.admin });
		if (!adminUser) {
			throw new AppError('User Not Found', 'No se encontró un usuario administrador para este comercio.', 404);
		}

		const temporaryPassword = newPassword && newPassword.length >= 6 ? newPassword : `Vexx${crypto.randomBytes(3).toString('hex')}!`;
		adminUser.password = temporaryPassword;
		await adminUser.save();

		return {
			email: adminUser.email,
			temporaryPassword
		};
	}

	/**
	 * Pausar y archivar un comercio (Soft-delete de resguardo).
	 */
	static async deleteTenant(tenantId: string): Promise<{ success: boolean; message: string }> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenant = await TenantModel.findById(tenantId);
		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		tenant.isActive = false;
		tenant.subscriptionStatus = 'suspended';
		await tenant.save();

		this.invalidateTenantCaches(tenant);

		return {
			success: true,
			message: `Comercio '${tenant.name}' (${tenant.slug}) pausado y archivado correctamente.`
		};
	}
}
