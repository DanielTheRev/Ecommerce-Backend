import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection, TenantModels } from '@/config/modelRegistry';
import { ITenant, TenantBusinessType } from '@/interfaces/tenant.interface';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { Role } from '@/interfaces/user.interface';
import { AppError } from '@/errors/app.error';
import { validateActiveAddonsForTenant } from '@/addons/registry';
import { EcommerceService } from '@/services/ecommerce.service';
import { TenantBootstrapService, BootstrapUserInput } from '@/services/tenantBootstrap.service';
import { CacheService } from '@/services/cache.service';

export type TenantHealthOverallStatus = 'healthy' | 'warning' | 'critical';
export type TenantHealthCheckStatus = 'ok' | 'warning' | 'error';
export type TenantHealthCheckKey =
	| 'master_record'
	| 'tenant_db'
	| 'ecommerce_config'
	| 'tenant_bootstrap'
	| 'owner_user'
	| 'products_smoke';

export interface TenantHealthCheckResult {
	key: TenantHealthCheckKey;
	label: string;
	status: TenantHealthCheckStatus;
	httpStatus?: number;
	errorCode?: string;
	message?: string;
	details?: string;
	durationMs: number;
}

export interface TenantHealthReport {
	tenantId: string;
	slug: string;
	dbName: string;
	overallStatus: TenantHealthOverallStatus;
	checkedAt: string;
	checks: TenantHealthCheckResult[];
}

export interface TenantHealthSummaryItem {
	overallStatus: TenantHealthOverallStatus;
	failedChecksCount: number;
	checkedAt: string;
}

export interface TenantBootstrapRepairResult extends TenantHealthReport {
	repairedActions: string[];
}

const VALID_BUSINESS_TYPES: TenantBusinessType[] = [
	'kiosk_grocery',
	'fashion',
	'tech_electronics',
	'butcher',
	'bakery',
	'gastronomy'
];

function extractErrorDetails(error: unknown): {
	httpStatus: number;
	errorCode: string;
	message: string;
	details: string;
} {
	if (error instanceof AppError) {
		return {
			httpStatus: error.statusCode || 500,
			errorCode: error.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
			message: error.message,
			details: error.stack ? error.stack.split('\n').slice(0, 2).join(' | ') : error.message
		};
	}

	if (error instanceof Error) {
		return {
			httpStatus: 500,
			errorCode: 'INTERNAL_ERROR',
			message: error.message || 'Error interno inesperado',
			details: error.stack ? error.stack.split('\n').slice(0, 2).join(' | ') : error.message
		};
	}

	const raw = String(error);
	return {
		httpStatus: 500,
		errorCode: 'UNKNOWN_ERROR',
		message: raw,
		details: raw
	};
}

async function runTimedCheck(
	key: TenantHealthCheckKey,
	label: string,
	fn: () => Promise<Omit<TenantHealthCheckResult, 'key' | 'label' | 'durationMs'>>
): Promise<TenantHealthCheckResult> {
	const startedAt = Date.now();
	try {
		const outcome = await fn();
		return {
			key,
			label,
			...outcome,
			durationMs: Date.now() - startedAt
		};
	} catch (error) {
		const parsed = extractErrorDetails(error);
		return {
			key,
			label,
			status: 'error',
			httpStatus: parsed.httpStatus,
			errorCode: parsed.errorCode,
			message: parsed.message,
			details: parsed.details,
			durationMs: Date.now() - startedAt
		};
	}
}

function computeOverallStatus(checks: TenantHealthCheckResult[]): TenantHealthOverallStatus {
	if (checks.some((c) => c.status === 'error')) {
		return 'critical';
	}
	if (checks.some((c) => c.status === 'warning')) {
		return 'warning';
	}
	return 'healthy';
}

export class TenantHealthService {
	private static async loadTenantOrThrow(tenantId: string): Promise<ITenant> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenant = await TenantModel.findById(tenantId).lean() as ITenant | null;
		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado en master_db.', 404);
		}
		return tenant;
	}

	private static checkMasterRecord(tenant: ITenant): TenantHealthCheckResult {
		const startedAt = Date.now();
		const missingFields: string[] = [];

		if (!tenant.businessType || !VALID_BUSINESS_TYPES.includes(tenant.businessType)) {
			missingFields.push(`businessType inválido o ausente ('${String(tenant.businessType)}')`);
		}

		if (!tenant.planTier || !Object.values(VexxPlanTier).includes(tenant.planTier)) {
			missingFields.push(`planTier inválido o ausente ('${String(tenant.planTier)}')`);
		}

		if (!Array.isArray(tenant.activeAddons)) {
			missingFields.push('activeAddons no está definido como arreglo en master_db');
		} else {
			try {
				validateActiveAddonsForTenant(tenant.activeAddons);
			} catch (err) {
				const parsed = extractErrorDetails(err);
				missingFields.push(parsed.message);
			}
		}

		if (missingFields.length > 0) {
			return {
				key: 'master_record',
				label: 'Ficha Maestra (Plan, Rubro y Add-ons)',
				status: 'error',
				httpStatus: 500,
				errorCode: 'MASTER_RECORD_INVALID',
				message: 'La ficha maestra del comercio tiene campos obligatorios faltantes o inválidos.',
				details: missingFields.join('; '),
				durationMs: Date.now() - startedAt
			};
		}

		if (!tenant.isActive || tenant.subscriptionStatus === 'suspended') {
			return {
				key: 'master_record',
				label: 'Ficha Maestra (Plan, Rubro y Add-ons)',
				status: 'warning',
				httpStatus: 403,
				errorCode: 'TENANT_PAUSED_OR_SUSPENDED',
				message: `Comercio con acceso pausado o suscripción '${tenant.subscriptionStatus}'.`,
				details: `isActive=${String(tenant.isActive)}, subscriptionStatus=${tenant.subscriptionStatus}`,
				durationMs: Date.now() - startedAt
			};
		}

		return {
			key: 'master_record',
			label: 'Ficha Maestra (Plan, Rubro y Add-ons)',
			status: 'ok',
			durationMs: Date.now() - startedAt
		};
	}

	/**
	 * Ejecuta el diagnóstico completo en modo lectura contra un comercio específico.
	 */
	static async checkTenantHealth(tenantId: string): Promise<TenantHealthReport> {
		const tenant = await this.loadTenantOrThrow(tenantId);
		return this.evaluateTenant(tenant);
	}

	private static async evaluateTenant(tenant: ITenant): Promise<TenantHealthReport> {
		const checks: TenantHealthCheckResult[] = [];
		checks.push(this.checkMasterRecord(tenant));

		let models: TenantModels | null = null;
		const dbCheck = await runTimedCheck('tenant_db', 'Conexión a Base de Datos', async () => {
			if (!tenant.dbName) {
				throw new AppError('Missing DB Name', 'El comercio no tiene dbName configurado en master_db.', 500);
			}
			const tenantDb = connectionManager.getTenantDb(tenant.dbName);
			await tenantDb.asPromise();
			if (!tenantDb.db) {
				throw new AppError('DB Connection Not Ready', `No se pudo obtener handle nativo para ${tenant.dbName}.`, 500);
			}
			await tenantDb.db.command({ ping: 1 });
			models = getModelsForConnection(tenantDb);
			return { status: 'ok' };
		});
		checks.push(dbCheck);

		if (!models) {
			const skippedReason = 'Omitido porque falló la conexión a la base de datos del comercio.';
			checks.push(
				{
					key: 'ecommerce_config',
					label: 'Configuración de Tienda (getConfig)',
					status: 'error',
					httpStatus: 500,
					errorCode: 'DB_UNAVAILABLE',
					message: skippedReason,
					durationMs: 0
				},
				{
					key: 'owner_user',
					label: 'Usuario Administrador Activo',
					status: 'error',
					httpStatus: 500,
					errorCode: 'DB_UNAVAILABLE',
					message: skippedReason,
					durationMs: 0
				},
				{
					key: 'tenant_bootstrap',
					label: 'Armado de Bootstrap (/api/tenant/bootstrap)',
					status: 'error',
					httpStatus: 500,
					errorCode: 'DB_UNAVAILABLE',
					message: skippedReason,
					durationMs: 0
				},
				{
					key: 'products_smoke',
					label: 'Lectura Base de Productos',
					status: 'error',
					httpStatus: 500,
					errorCode: 'DB_UNAVAILABLE',
					message: skippedReason,
					durationMs: 0
				}
			);

			return {
				tenantId: String(tenant._id),
				slug: tenant.slug,
				dbName: tenant.dbName,
				overallStatus: computeOverallStatus(checks),
				checkedAt: new Date().toISOString(),
				checks
			};
		}

		const activeModels = models as TenantModels;

		const configCheck = await runTimedCheck('ecommerce_config', 'Configuración de Tienda (getConfig)', async () => {
			await EcommerceService.getConfig(activeModels, tenant);
			return { status: 'ok' };
		});
		checks.push(configCheck);

		let ownerUser: BootstrapUserInput | null = null;
		const ownerCheck = await runTimedCheck('owner_user', 'Dueño del Comercio Activo (StoreOwner)', async () => {
			const StoreOwnerModel = connectionManager.getStoreOwnerModel();
			const owner = await StoreOwnerModel.findOne({ tenantId: tenant._id, isActive: { $ne: false } })
				.select('_id name lastName email')
				.lean();

			if (!owner) {
				return {
					status: 'error',
					httpStatus: 404,
					errorCode: 'OWNER_USER_NOT_FOUND',
					message: 'No existe ningún dueño (StoreOwner) activo en master_db para este comercio.',
					details: `Collection store_owners en master_db no tiene registros activos para tenantId=${tenant._id}.`
				};
			}

			ownerUser = {
				_id: owner._id,
				name: owner.name,
				lastName: owner.lastName,
				email: owner.email,
				role: Role.admin,
				permissions: ['*']
			};
			return { status: 'ok' };
		});
		checks.push(ownerCheck);

		const bootstrapCheck = await runTimedCheck('tenant_bootstrap', 'Armado de Bootstrap (/api/tenant/bootstrap)', async () => {
			const userForBootstrap: BootstrapUserInput = ownerUser || {
				_id: 'health-check',
				name: tenant.ownerContact?.name || tenant.name,
				email: tenant.ownerContact?.email || 'health@vexx.ar',
				role: Role.admin,
				permissions: []
			};

			await TenantBootstrapService.buildBootstrapPayload(activeModels, tenant, userForBootstrap);
			return { status: 'ok' };
		});
		checks.push(bootstrapCheck);

		const productsCheck = await runTimedCheck('products_smoke', 'Lectura Base de Productos', async () => {
			await activeModels.Product.findOne().select('_id').lean();
			await activeModels.Product.estimatedDocumentCount();
			return { status: 'ok' };
		});
		checks.push(productsCheck);

		return {
			tenantId: String(tenant._id),
			slug: tenant.slug,
			dbName: tenant.dbName,
			overallStatus: computeOverallStatus(checks),
			checkedAt: new Date().toISOString(),
			checks
		};
	}

	/**
	 * Resumen masivo de salud para la tabla de comercios del SuperAdmin.
	 */
	static async getHealthSummary(): Promise<Record<string, TenantHealthSummaryItem>> {
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const tenants = await TenantModel.find().lean() as ITenant[];

		const reports = await Promise.all(
			tenants.map((tenant) => this.evaluateTenant(tenant))
		);

		const summary: Record<string, TenantHealthSummaryItem> = {};
		for (const report of reports) {
			summary[report.tenantId] = {
				overallStatus: report.overallStatus,
				failedChecksCount: report.checks.filter((c) => c.status === 'error').length,
				checkedAt: report.checkedAt
			};
		}
		return summary;
	}

	/**
	 * Crea documentos base faltantes (EcommerceConfig) usando los metadatos de master_db
	 * sin sobrescribir configuración existente ni productos.
	 */
	static async repairTenantBootstrap(tenantId: string): Promise<TenantBootstrapRepairResult> {
		const tenant = await this.loadTenantOrThrow(tenantId);
		const tenantDb = connectionManager.getTenantDb(tenant.dbName);
		const models = getModelsForConnection(tenantDb);
		const repairedActions: string[] = [];

		const existingConfig = await models.EcommerceConfig.findOne({ key: 'global_config' });
		if (!existingConfig) {
			await models.EcommerceConfig.create({
				key: 'global_config',
				name: tenant.name,
				businessType: tenant.businessType
			});
			repairedActions.push('EcommerceConfig (global_config) creado con datos de master_db.');
		} else if (!existingConfig.businessType && tenant.businessType) {
			existingConfig.businessType = tenant.businessType;
			await existingConfig.save();
			repairedActions.push('EcommerceConfig.businessType completado desde master_db.');
		}

		connectionManager.invalidateTenantCache(tenant.slug);
		if (tenant.domain) {
			const cleanDomain = tenant.domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
			if (cleanDomain) connectionManager.invalidateTenantCache(cleanDomain);
		}
		if (tenant.apiKey) {
			connectionManager.invalidateTenantCache(tenant.apiKey);
		}
		CacheService.invalidatePrefix(tenant.slug, 'config');

		const health = await this.evaluateTenant(tenant);
		return {
			...health,
			repairedActions
		};
	}
}
