import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { AppError } from '@/errors/app.error';
import {
	getAddonModule,
	getPublicAddonCatalog,
	getSuggestedAddonsForSetup,
	getTenantAddonStoreItems,
	normalizeActiveAddons,
	validateAddonSettings
} from '@/addons/registry';
import { BUSINESS_VERTICAL_OPTIONS, getPlanLimits } from '@/config/planCapabilities';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection, TenantModels } from '@/config/modelRegistry';
import { ITenant } from '@/interfaces/tenant.interface';
import { StorefrontTemplateService } from '@/services/storefrontTemplate.service';
import { SubscriptionPlanService } from '@/services/subscriptionPlan.service';
import { CacheService } from '@/services/cache.service';

const PLAN_COMMERCIAL_METADATA: Record<
	VexxPlanTier,
	{ name: string; title: string; description: string; monthlyPriceARS: number; includedAddonsLimit: number }
> = {
	[VexxPlanTier.LOCAL]: {
		name: 'Vexx Local',
		title: 'Operación física & mostrador',
		description: 'POS de mostrador, cobro en caja y gestión local.',
		monthlyPriceARS: 30000,
		includedAddonsLimit: 3
	},
	[VexxPlanTier.POINT]: {
		name: 'Vexx Point',
		title: 'Local + Catálogo & Pedidos Online',
		description: 'Punto físico con catálogo interactivo, pedidos online y delivery local.',
		monthlyPriceARS: 48000,
		includedAddonsLimit: 5
	},
	[VexxPlanTier.PRO]: {
		name: 'Vexx Pro',
		title: 'Omnicanal & Escala',
		description: 'Tienda web completa, dominio propio, métricas y facturación fiscal.',
		monthlyPriceARS: 85000,
		includedAddonsLimit: 10
	}
};

const VERTICAL_SUGGESTED_LABELS: Record<string, Record<string, string>> = {
	kiosk_grocery: {
		bundleTitle: 'Promos & Combos de Mostrador',
		weightTitle: 'Productos por Peso / Fiambrería'
	},
	fashion: {
		variantsTitle: 'Talles & Colores',
		bundleTitle: 'Looks & Conjuntos'
	},
	tech_electronics: {
		variantsTitle: 'Capacidad & Color',
		bundleTitle: 'Kits & Accesorios'
	},
	butcher: {
		bundleTitle: 'Combos Parrilleros & Packs de Asado',
		variantsTitle: 'Presentaciones & Packs',
		weightTitle: 'Cortes por Kilo ($/Kg) & Balanza'
	},
	bakery: {
		bundleTitle: 'Cajas & Docenas Surtidas',
		variantsTitle: 'Porciones & Docenas',
		weightTitle: 'Panificados por Kilo ($/Kg)'
	},
	gastronomy: {
		bundleTitle: 'Menús & Promos del Día',
		variantsTitle: 'Tamaños & Agregados'
	}
};

export class AddonController {
	/**
	 * GET /api/master/addons
	 * Catálogo maestro oficial de complementos para SuperAdmin Console.
	 */
	static async getMasterCatalog(_req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const catalog = getPublicAddonCatalog();
			res.status(200).json({
				success: true,
				count: catalog.length,
				data: catalog
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/onboarding-config
	 * Configuración completa para el Wizard de Alta de Comercios en SuperAdmin:
	 * planes con límites, rubros preconfigurados y catálogo oficial de complementos.
	 */
	static async getMasterOnboardingConfig(_req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const dbPlans = await SubscriptionPlanService.listAllPlans(false);
			const plans = dbPlans.map((p) => ({
				code: p.code,
				baseTier: p.baseTier,
				name: p.name,
				title: p.title,
				description: p.description,
				monthlyPriceARS: p.monthlyPriceARS,
				annualPriceARS: p.annualPriceARS,
				includedAddonsLimit: p.includedAddonsLimit,
				limits: p.limits,
				defaultAddons: p.defaultAddons,
				badgeText: p.badgeText,
				isFeatured: p.isFeatured
			}));

			const verticals = BUSINESS_VERTICAL_OPTIONS.map((v) => ({
				...v,
				suggestedLabels: VERTICAL_SUGGESTED_LABELS[v.code] || {},
				suggestedAddonsByPlan: {
					local: getSuggestedAddonsForSetup(VexxPlanTier.LOCAL, v.code),
					point: getSuggestedAddonsForSetup(VexxPlanTier.POINT, v.code),
					pro: getSuggestedAddonsForSetup(VexxPlanTier.PRO, v.code)
				}
			}));

			const addons = getPublicAddonCatalog();
			const storefrontTemplates = await StorefrontTemplateService.listAllTemplates(false);

			res.status(200).json({
				success: true,
				data: {
					baseDomain: StorefrontTemplateService.getBaseDomain(),
					plans,
					verticals,
					addons,
					storefrontTemplates
				}
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/addons/catalog
	 * Tienda de complementos para el comercio actual (Panel Web y Android).
	 */
	static async getTenantCatalog(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.tenant || !req.models) {
				throw new AppError('Tenant not resolved', 'No se pudo resolver el comercio.', 500);
			}

			const installations = await req.models.AddonInstallation.find().lean();
			const installedMap: Record<string, { isConfigured?: boolean; settings?: Record<string, unknown> }> = {};
			for (const inst of installations) {
				installedMap[inst.addonId] = {
					isConfigured: inst.isConfigured,
					settings: inst.settings
				};
			}

			const items = getTenantAddonStoreItems(req.tenant.activeAddons || [], installedMap);
			res.status(200).json({
				success: true,
				count: items.length,
				data: items
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PUT /api/addons/:addonId/settings
	 * Valida con el schema Zod del módulo y guarda su configuración aislada.
	 */
	static async updateAddonSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.tenant || !req.models) {
				throw new AppError('Tenant not resolved', 'No se pudo resolver el comercio.', 500);
			}

			const mod = getAddonModule(req.params.addonId);
			if (!mod) {
				throw new AppError('Addon not found', `El complemento '${req.params.addonId}' no existe.`, 404);
			}

			const activeSet = new Set(normalizeActiveAddons(req.tenant.activeAddons || []));
			if (!activeSet.has(mod.manifest.id)) {
				throw new AppError(
					'Addon not active',
					`No podés configurar '${mod.manifest.name}' porque no está activado para este comercio.`,
					403
				);
			}

			const validatedSettings = validateAddonSettings(mod.manifest.id, req.body);

			const updated = await req.models.AddonInstallation.findOneAndUpdate(
				{ addonId: mod.manifest.id },
				{
					$set: {
						addonId: mod.manifest.id,
						isConfigured: true,
						settings: validatedSettings,
						configuredAt: new Date()
					}
				},
				{ new: true, upsert: true }
			);

			await AddonController.syncAddonSettingsWithEcommerceConfig(
				req.models,
				mod.manifest.id,
				validatedSettings,
				req.tenant.slug
			);

			res.status(200).json({
				success: true,
				message: `Configuración de '${mod.manifest.name}' guardada correctamente.`,
				data: updated
			});
		} catch (error) {
			next(error);
		}
	}

	private static async syncAddonSettingsWithEcommerceConfig(
		models: TenantModels,
		addonId: string,
		settings: Record<string, unknown>,
		tenantSlug?: string
	): Promise<void> {
		try {
			if (addonId === 'customer_auth') {
				const authUpdate: Record<string, unknown> = {};
				if (typeof settings.enableGoogleSignInOption === 'boolean') {
					authUpdate['authConfig.allowGoogle'] = settings.enableGoogleSignInOption;
				}
				if (typeof settings.enableMagicCodeOption === 'boolean') {
					authUpdate['authConfig.allowMagicCode'] = settings.enableMagicCodeOption;
				}
				if (typeof settings.enableEmailPasswordOption === 'boolean') {
					authUpdate['authConfig.allowEmailPassword'] = settings.enableEmailPasswordOption;
				}
				if (typeof settings.defaultAuthMethod === 'string') {
					authUpdate['authConfig.defaultMethod'] = settings.defaultAuthMethod;
				}
				if (Object.keys(authUpdate).length > 0) {
					await models.EcommerceConfig.findOneAndUpdate(
						{ key: 'global_config' },
						{ $set: authUpdate },
						{ upsert: true }
					);
				}
			} else if (addonId === 'pos') {
				const posUpdate: Record<string, unknown> = {};
				if (typeof settings.transferValidationMode === 'string') {
					posUpdate['posConfig.transferValidationMode'] = settings.transferValidationMode;
				}
				if (typeof settings.allowManualDiscount === 'boolean') {
					posUpdate['posConfig.allowManualDiscount'] = settings.allowManualDiscount;
				}
				if (typeof settings.autoPrintReceipt === 'boolean') {
					posUpdate['posConfig.autoPrintReceipt'] = settings.autoPrintReceipt;
				}
				if (Object.keys(posUpdate).length > 0) {
					await models.EcommerceConfig.findOneAndUpdate(
						{ key: 'global_config' },
						{ $set: posUpdate },
						{ upsert: true }
					);
				}
			}
			if (tenantSlug) {
				CacheService.invalidatePrefix(tenantSlug, 'config');
			}
		} catch {
			// En entornos aislados sin colección EcommerceConfig no interrumpir
		}
	}

	private static async resolveMasterTenantAddonContext(tenantId: string, addonId: string) {
		const mod = getAddonModule(addonId);
		if (!mod) {
			throw new AppError('Addon not found', `El complemento '${addonId}' no existe en el catálogo de Vexx.`, 404);
		}

		const TenantModel = connectionManager.getMasterDb().model<ITenant>('Tenant');
		const tenant = await TenantModel.findById(tenantId).lean();
		if (!tenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		const models = getModelsForConnection(connectionManager.getTenantDb(tenant.dbName));
		return { mod, tenant, models };
	}

	/**
	 * GET /api/master/tenants/:id/addons/:addonId/settings
	 */
	static async getMasterTenantAddonSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const tenantId = String(req.params.id);
			const addonId = String(req.params.addonId);
			const { mod, models } = await AddonController.resolveMasterTenantAddonContext(tenantId, addonId);

			const defaultSettings: Record<string, unknown> = {};
			for (const def of mod.manifest.configurableSettings || []) {
				defaultSettings[def.key] = def.defaultValue;
			}

			const installation = await models.AddonInstallation.findOne({ addonId: mod.manifest.id }).lean();
			const settings = {
				...defaultSettings,
				...(installation?.settings || {})
			};

			res.status(200).json({
				success: true,
				data: {
					tenantId,
					addonId: mod.manifest.id,
					settings
				}
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PUT /api/master/tenants/:id/addons/:addonId/settings
	 */
	static async updateMasterTenantAddonSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const tenantId = String(req.params.id);
			const addonId = String(req.params.addonId);
			const { mod, tenant, models } = await AddonController.resolveMasterTenantAddonContext(tenantId, addonId);

			const rawPayload =
				req.body && typeof req.body === 'object' && 'settings' in req.body && req.body.settings && typeof req.body.settings === 'object'
					? req.body.settings
					: req.body;

			const validatedSettings = validateAddonSettings(mod.manifest.id, rawPayload);

			await models.AddonInstallation.findOneAndUpdate(
				{ addonId: mod.manifest.id },
				{
					$set: {
						addonId: mod.manifest.id,
						isConfigured: true,
						settings: validatedSettings,
						configuredAt: new Date()
					}
				},
				{ new: true, upsert: true }
			);

			await AddonController.syncAddonSettingsWithEcommerceConfig(
				models,
				mod.manifest.id,
				validatedSettings,
				tenant.slug
			);

			connectionManager.invalidateTenantCache();

			res.status(200).json({
				success: true,
				data: {
					tenantId,
					addonId: mod.manifest.id,
					settings: validatedSettings
				}
			});
		} catch (error) {
			next(error);
		}
	}
}
