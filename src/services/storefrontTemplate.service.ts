import { z } from 'zod';
import { connectionManager } from '@/config/multitenancy';
import { AppError } from '@/errors/app.error';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { ITenant, TenantBusinessType } from '@/interfaces/tenant.interface';
import {
	IStorefrontTemplate,
	ITemplateCustomizableField,
	ITenantStorefrontSummary,
	TEMPLATE_CHECKOUT_MODES,
	TEMPLATE_DOMAIN_MODES,
	TEMPLATE_ENGINE_TYPES,
	TEMPLATE_PRICING_TYPES,
	TemplateKind,
	TenantDomainMode
} from '@/interfaces/storefrontTemplate.interface';
import { StorefrontTemplateSchema } from '@/models/StorefrontTemplate.model';
import { getEffectivePlanCapabilities } from '@/config/planCapabilities';
import { CacheService } from './cache.service';
import { loadAllTenantOrigins } from '@/config/cors';

const TEMPLATE_KEY_REGEX = /^[a-z0-9_-]+$/;
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

const PLAN_TIER_RANK: Record<VexxPlanTier, number> = {
	[VexxPlanTier.LOCAL]: 0,
	[VexxPlanTier.POINT]: 1,
	[VexxPlanTier.PRO]: 2
};

export const TemplateCustomizableFieldZodSchema = z.object({
	key: z.string().trim().min(1),
	label: z.string().trim().min(1),
	type: z.enum(['string', 'boolean', 'select', 'color']),
	defaultValue: z.union([z.string(), z.boolean()]),
	options: z.array(z.string().trim().min(1)).optional(),
	description: z.string().trim().optional()
});

export const UpsertStorefrontTemplateZodSchema = z.object({
	key: z
		.string()
		.trim()
		.toLowerCase()
		.regex(TEMPLATE_KEY_REGEX, 'La clave (key) debe contener solo minúsculas, números, guiones y guiones bajos.'),
	name: z.string().trim().min(1, 'El nombre de la plantilla es obligatorio.'),
	shortDescription: z.string().trim().min(1, 'La descripción corta es obligatoria.'),
	longDescription: z.string().trim().optional(),
	engine: z.enum(TEMPLATE_ENGINE_TYPES).default('astro'),
	checkoutMode: z.enum(TEMPLATE_CHECKOUT_MODES).default('whatsapp_and_pickup'),
	templateKind: z.enum(['mobile_catalog', 'full_website']).optional(),
	thumbnailUrl: z.string().trim().default(''),
	previewUrl: z.string().trim().optional(),
	minPlanTier: z.nativeEnum(VexxPlanTier).default(VexxPlanTier.POINT),
	supportedBusinessTypes: z.array(z.string().trim().min(1)).default(['*']),
	pricingType: z.enum(TEMPLATE_PRICING_TYPES).default('included_in_plan'),
	priceARS: z.number().min(0).default(0),
	monthlyPriceARS: z.number().min(0).optional(),
	oneTimePriceARS: z.number().min(0).optional(),
	features: z.array(z.string().trim().min(1)).default([]),
	customizableFields: z.array(TemplateCustomizableFieldZodSchema).default([]),
	isDefaultForPlan: z.record(z.string(), z.boolean()).optional(),
	isDefaultForBusinessType: z.record(z.string(), z.boolean()).optional(),
	isActive: z.boolean().default(true)
});

export const UpdateStorefrontTemplateZodSchema = UpsertStorefrontTemplateZodSchema.omit({ key: true }).partial();

export const SuperAdminUpdateTenantStorefrontZodSchema = z.object({
	activeTemplateKey: z.string().trim().toLowerCase().optional(),
	unlockedTemplates: z.array(z.string().trim().toLowerCase()).optional(),
	domainMode: z.enum(TEMPLATE_DOMAIN_MODES).optional(),
	customDomain: z.string().trim().toLowerCase().nullable().optional(),
	templateSettings: z.record(z.string(), z.unknown()).optional()
});

export const DEFAULT_STOREFRONT_TEMPLATES: IStorefrontTemplate[] = [
	{
		key: 'atelier_editorial',
		name: 'Atelier Editorial',
		shortDescription:
			'Tienda online minimalista de alto impacto visual con fotografía en primer plano, variantes por color y talle, bloques modulares y checkout adaptable.',
		longDescription:
			'Diseño editorial orientado a conversión con grilla 4:5, selector inteligente de variantes, bloques armables y medios de pago en cuotas/transferencia. ' +
			'Guía de activación: para aprovechar todas las secciones verificá tener activos los addons correspondientes en tu panel (Pasarela de Pagos / Transferencia, Guía de Talles, Shop the Look, Menú Bento y Favoritos).',
		engine: 'astro',
		checkoutMode: 'full_ecommerce',
		templateKind: 'full_website',
		thumbnailUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
		previewUrl: 'https://demo.vexx.com.ar',
		minPlanTier: VexxPlanTier.POINT,
		supportedBusinessTypes: ['*'],
		pricingType: 'included_in_plan',
		priceARS: 0,
		monthlyPriceARS: 0,
		features: [
			'Fotografía editorial 4:5 con galería vinculada por variante/color',
			'Desglose transparente de precio por transferencia y cuotas sin interés',
			'Bloques modulares activables según plan: Shop the Look, Guía de Talles, Menú Bento y Favoritos',
			'Advertencia: requiere configurar al menos un medio de cobro y envío activo en el panel para habilitar el checkout'
		],
		customizableFields: [
			{
				key: 'announcementBarText',
				label: 'Texto de barra superior',
				type: 'string',
				defaultValue: 'Cuotas sin interés · Envíos a todo el país'
			},
			{
				key: 'primaryColor',
				label: 'Color de acento principal',
				type: 'color',
				defaultValue: '#111111'
			},
			{
				key: 'cardAspectRatio',
				label: 'Proporción de tarjeta de producto',
				type: 'select',
				defaultValue: '4:5',
				options: ['4:5', '1:1', '9:16']
			},
			{
				key: 'checkoutStyle',
				label: 'Flujo de Checkout',
				type: 'select',
				defaultValue: 'single_page',
				options: ['single_page', 'three_steps'],
				description: 'Elegí entre checkout rápido en 1 sola pantalla o flujo guiado en 3 pasos.'
			},
			{
				key: 'showCombineWith',
				label: 'Mostrar bloque "Completá el Look" (requiere addon Shop the Look)',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showSizeGuideDrawer',
				label: 'Mostrar Guía de Talles (requiere addon Guía de Talles)',
				type: 'boolean',
				defaultValue: true
			}
		],
		isDefaultForPlan: {
			[VexxPlanTier.POINT]: true,
			[VexxPlanTier.PRO]: true
		},
		isDefaultForBusinessType: {
			fashion: true
		},
		isActive: true
	}
];

export class StorefrontTemplateService {
	private static seededCheckDone = false;

	private static getModel() {
		const masterDb = connectionManager.getMasterDb();
		if (!masterDb.models.StorefrontTemplate) {
			masterDb.model<IStorefrontTemplate>('StorefrontTemplate', StorefrontTemplateSchema);
		}
		return masterDb.model<IStorefrontTemplate>('StorefrontTemplate');
	}

	static getBaseDomain(): string {
		return (process.env.VEXX_BASE_DOMAIN || 'vexx.com.ar').trim().toLowerCase();
	}

	static normalizeCustomDomain(rawDomain?: string | null): string | undefined {
		if (!rawDomain || typeof rawDomain !== 'string') return undefined;
		const clean = rawDomain
			.trim()
			.toLowerCase()
			.replace(/^https?:\/\//, '')
			.replace(/\/.*$/, '')
			.replace(/:\d+$/, '')
			.replace(/^www\./, '');
		if (!clean) return undefined;
		if (!DOMAIN_REGEX.test(clean)) {
			throw new AppError(
				'Invalid domain format',
				`El dominio '${rawDomain}' no tiene un formato válido (ej: mitienda.com.ar).`,
				400
			);
		}
		const baseDomain = this.getBaseDomain();
		if (clean === baseDomain || clean.endsWith(`.${baseDomain}`)) {
			throw new AppError(
				'Reserved platform domain',
				`No podés ingresar un subdominio de '${baseDomain}' como dominio propio. Tu subdominio gratuito ya está incluido.`,
				400
			);
		}
		return clean;
	}

	/**
	 * Siembra de forma idempotente el catálogo inicial de plantillas en master_db si está vacío.
	 */
	static async ensureDefaultTemplatesSeeded(): Promise<void> {
		if (this.seededCheckDone) return;
		try {
			const Model = this.getModel();
			const count = await Model.countDocuments();
			if (count === 0) {
				await Model.insertMany(DEFAULT_STOREFRONT_TEMPLATES);
			}
			this.seededCheckDone = true;
		} catch {
			// Si masterDb no está conectado en un test unitario sin DB, no bloquear
		}
	}

	// =========================================================================
	// CRUD SUPERADMIN (console.vexx / superAdminPanel)
	// =========================================================================

	static async listAllTemplates(includeInactive = true): Promise<IStorefrontTemplate[]> {
		await this.ensureDefaultTemplatesSeeded();
		const Model = this.getModel();
		const filter = includeInactive ? {} : { isActive: true };
		return (await Model.find(filter).sort({ minPlanTier: 1, priceARS: 1, key: 1 }).lean()) as IStorefrontTemplate[];
	}

	static async getTemplateByKey(key: string): Promise<IStorefrontTemplate> {
		await this.ensureDefaultTemplatesSeeded();
		const cleanKey = (key || '').trim().toLowerCase();
		const Model = this.getModel();
		const doc = (await Model.findOne({ key: cleanKey }).lean()) as IStorefrontTemplate | null;
		if (!doc) {
			throw new AppError('Template not found', `La plantilla '${cleanKey}' no existe en el catálogo maestro.`, 404);
		}
		return doc;
	}

	static async createTemplate(rawBody: unknown): Promise<IStorefrontTemplate> {
		await this.ensureDefaultTemplatesSeeded();
		const parsed = UpsertStorefrontTemplateZodSchema.parse(rawBody);
		const Model = this.getModel();

		const existing = await Model.findOne({ key: parsed.key }).lean();
		if (existing) {
			throw new AppError('Template conflict', `Ya existe una plantilla con la clave '${parsed.key}'.`, 409);
		}

		const created = await Model.create(parsed);
		return created.toObject();
	}

	static async updateTemplate(key: string, rawBody: unknown): Promise<IStorefrontTemplate> {
		await this.ensureDefaultTemplatesSeeded();
		const cleanKey = (key || '').trim().toLowerCase();
		if (!TEMPLATE_KEY_REGEX.test(cleanKey)) {
			throw new AppError('Invalid template key', `La clave '${key}' no es válida.`, 400);
		}

		const parsed = UpdateStorefrontTemplateZodSchema.parse(rawBody);
		const Model = this.getModel();

		const updated = (await Model.findOneAndUpdate(
			{ key: cleanKey },
			{ $set: parsed },
			{ new: true }
		).lean()) as IStorefrontTemplate | null;

		if (!updated) {
			throw new AppError('Template not found', `La plantilla '${cleanKey}' no existe en el catálogo maestro.`, 404);
		}
		return updated;
	}

	static async deleteTemplate(key: string): Promise<{ deletedKey: string }> {
		await this.ensureDefaultTemplatesSeeded();
		const cleanKey = (key || '').trim().toLowerCase();
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenantsUsingIt = await TenantModel.countDocuments({
			activeTemplateKey: cleanKey,
			isActive: true
		});

		if (tenantsUsingIt > 0) {
			throw new AppError(
				'Template in use',
				`No se puede eliminar la plantilla '${cleanKey}' porque está activa en ${tenantsUsingIt} comercio(s). Cambiá primero su plantilla o desactivala con isActive: false.`,
				409
			);
		}

		const Model = this.getModel();
		const deleted = await Model.findOneAndDelete({ key: cleanKey }).lean();
		if (!deleted) {
			throw new AppError('Template not found', `La plantilla '${cleanKey}' no existe.`, 404);
		}

		return { deletedKey: cleanKey };
	}

	// =========================================================================
	// LÓGICA DE DESBLOQUEO, RESOLUCIÓN Y CONFIGURACIÓN POR COMERCIO
	// =========================================================================

	static isTemplateUnlockedForTenant(template: IStorefrontTemplate, tenant: ITenant): boolean {
		const unlockedSet = new Set((tenant.unlockedTemplates || []).map((k) => k.toLowerCase()));
		if (unlockedSet.has(template.key.toLowerCase())) {
			return true;
		}
		if (tenant.activeTemplateKey && tenant.activeTemplateKey.toLowerCase() === template.key.toLowerCase()) {
			return true;
		}
		const tenantTier = tenant.planTier || VexxPlanTier.LOCAL;
		const tenantRank = PLAN_TIER_RANK[tenantTier] ?? 0;
		const requiredRank = PLAN_TIER_RANK[template.minPlanTier] ?? 1;

		if (template.pricingType === 'included_in_plan' && tenantRank >= requiredRank) {
			return true;
		}
		return false;
	}

	static isTemplateCompatibleWithBusinessType(template: IStorefrontTemplate, businessType?: TenantBusinessType): boolean {
		if (!template.supportedBusinessTypes || template.supportedBusinessTypes.length === 0) return true;
		if (template.supportedBusinessTypes.includes('*')) return true;
		if (!businessType) return true;
		return template.supportedBusinessTypes.includes(businessType);
	}

	static resolveTemplateSettingsWithDefaults(
		template: IStorefrontTemplate | undefined,
		savedSettings?: Record<string, unknown>
	): Record<string, unknown> {
		const resolved: Record<string, unknown> = {};
		if (template?.customizableFields) {
			for (const field of template.customizableFields) {
				resolved[field.key] = field.defaultValue;
			}
		}
		if (savedSettings && typeof savedSettings === 'object') {
			for (const [k, v] of Object.entries(savedSettings)) {
				if (v !== undefined) {
					resolved[k] = v;
				}
			}
		}
		return resolved;
	}

	static selectDefaultTemplateForTenant(
		templates: IStorefrontTemplate[],
		planTier?: VexxPlanTier,
		businessType?: TenantBusinessType
	): IStorefrontTemplate | undefined {
		const tier = planTier || VexxPlanTier.LOCAL;
		if (tier === VexxPlanTier.LOCAL) {
			return undefined;
		}
		const activeTemplates = templates.filter((t) => t.isActive);
		// 1. Buscar plantilla por defecto para ese rubro y accesible en su plan
		if (businessType) {
			const byVertical = activeTemplates.find(
				(t) =>
					t.isDefaultForBusinessType?.[businessType] &&
					t.pricingType === 'included_in_plan' &&
					(PLAN_TIER_RANK[tier] ?? 0) >= (PLAN_TIER_RANK[t.minPlanTier] ?? 1)
			);
			if (byVertical) return byVertical;
		}
		// 2. Buscar plantilla por defecto para el plan
		const byPlan = activeTemplates.find(
			(t) =>
				t.isDefaultForPlan?.[tier] &&
				t.pricingType === 'included_in_plan' &&
				(PLAN_TIER_RANK[tier] ?? 0) >= (PLAN_TIER_RANK[t.minPlanTier] ?? 1)
		);
		if (byPlan) return byPlan;

		// 3. Fallback a point_mobile_catalog si existe
		return activeTemplates.find((t) => t.key === 'point_mobile_catalog') || activeTemplates[0];
	}

	static async buildTenantStorefrontSummary(
		tenant: ITenant,
		preloadedTemplates?: IStorefrontTemplate[]
	): Promise<ITenantStorefrontSummary> {
		let templates = preloadedTemplates;
		if (!templates) {
			try {
				templates = await this.listAllTemplates(true);
			} catch {
				templates = DEFAULT_STOREFRONT_TEMPLATES;
			}
		}

		const baseDomain = this.getBaseDomain();
		const vexxSubdomain = `${tenant.slug}.${baseDomain}`;
		const vexxSubdomainUrl = `https://${vexxSubdomain}`;

		const cleanCustomDomain = tenant.domain
			? tenant.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
			: undefined;
		const customDomainUrl = cleanCustomDomain ? `https://${cleanCustomDomain}` : undefined;

		const capabilities = tenant.planTier
			? getEffectivePlanCapabilities(tenant.planTier, tenant.businessType, tenant.activeAddons)
			: undefined;
		const hasCustomDomainCapability = Boolean(capabilities?.hasCustomDomain);

		const domainMode: TenantDomainMode =
			cleanCustomDomain && (tenant.domainMode === 'custom_domain' || !tenant.domainMode)
				? 'custom_domain'
				: 'vexx_subdomain';

		const primaryStorefrontUrl =
			domainMode === 'custom_domain' && customDomainUrl ? customDomainUrl : vexxSubdomainUrl;

		let activeTemplate = tenant.activeTemplateKey
			? templates.find((t) => t.key === tenant.activeTemplateKey)
			: undefined;

		if (!activeTemplate && (capabilities?.hasThemeTemplates || capabilities?.hasWebCatalog || capabilities?.hasFullWebStore)) {
			activeTemplate = this.selectDefaultTemplateForTenant(templates, tenant.planTier, tenant.businessType);
		}

		const resolvedSettings = this.resolveTemplateSettingsWithDefaults(activeTemplate, tenant.templateSettings);

		return {
			domainMode,
			vexxSubdomain,
			vexxSubdomainUrl,
			...(cleanCustomDomain ? { customDomain: cleanCustomDomain, customDomainUrl } : {}),
			primaryStorefrontUrl,
			hasCustomDomainCapability,
			activeTemplateKey: activeTemplate?.key || tenant.activeTemplateKey,
			activeTemplateName: activeTemplate?.name,
			activeTemplateEngine: activeTemplate?.engine,
			activeTemplateCheckoutMode: activeTemplate?.checkoutMode,
			unlockedTemplates: tenant.unlockedTemplates || [],
			templateSettings: resolvedSettings
		};
	}

	/**
	 * Devuelve el catálogo de plantillas enriquecido para el comercio actual (control-panel / android).
	 */
	/**
	 * Tipo comercial de la plantilla. Si el catálogo maestro lo define explícitamente se respeta;
	 * si no, se deduce del modo de checkout (whatsapp_and_pickup = catálogo móvil, resto = web completa).
	 */
	static resolveTemplateKind(tpl: Pick<IStorefrontTemplate, 'templateKind' | 'checkoutMode'>): TemplateKind {
		if (tpl.templateKind) return tpl.templateKind;
		return tpl.checkoutMode === 'whatsapp_and_pickup' ? 'mobile_catalog' : 'full_website';
	}

	static async getCatalogForTenant(tenant: ITenant) {
		const templates = await this.listAllTemplates(false);
		const summary = await this.buildTenantStorefrontSummary(tenant, templates);

		const items = templates.map((tpl) => {
			const isUnlocked = this.isTemplateUnlockedForTenant(tpl, tenant);
			const isCompatibleWithBusinessType = this.isTemplateCompatibleWithBusinessType(tpl, tenant.businessType);
			const isActive = summary.activeTemplateKey === tpl.key;
			return {
				...tpl,
				templateKind: this.resolveTemplateKind(tpl),
				isUnlocked,
				isActive,
				isCompatibleWithBusinessType,
				isPurchasable: !isUnlocked && tpl.pricingType !== 'included_in_plan',
				currentSettings: isActive ? summary.templateSettings : this.resolveTemplateSettingsWithDefaults(tpl)
			};
		});

		return {
			storefront: summary,
			templates: items
		};
	}

	/**
	 * Permite al comerciante activar una plantilla desbloqueada en su cuenta.
	 */
	static async activateTemplateForTenant(tenant: ITenant, templateKey: string) {
		const capabilities = tenant.planTier
			? getEffectivePlanCapabilities(tenant.planTier, tenant.businessType, tenant.activeAddons)
			: undefined;

		if (!capabilities?.hasThemeTemplates && !capabilities?.hasWebCatalog && !capabilities?.hasFullWebStore) {
			throw new AppError(
				'Capability required',
				'Tu plan actual no incluye plantillas web ni catálogo interactivo. Actualizá a Vexx POINT o PRO.',
				403
			);
		}

		const cleanKey = (templateKey || '').trim().toLowerCase();
		const template = await this.getTemplateByKey(cleanKey);
		if (!template.isActive) {
			throw new AppError('Template inactive', `La plantilla '${template.name}' no está disponible actualmente.`, 400);
		}

		if (!this.isTemplateUnlockedForTenant(template, tenant)) {
			throw new AppError(
				'Template locked',
				`La plantilla '${template.name}' requiere el plan ${template.minPlanTier.toUpperCase()} o ser habilitada en tu cuenta.`,
				403
			);
		}

		const mergedSettings = this.resolveTemplateSettingsWithDefaults(template, tenant.templateSettings);
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const updatedTenant = (await TenantModel.findByIdAndUpdate(
			tenant._id,
			{
				$set: {
					activeTemplateKey: template.key,
					templateSettings: mergedSettings
				}
			},
			{ new: true }
		).lean()) as ITenant | null;

		if (!updatedTenant) {
			throw new AppError('Tenant not found', 'Comercio no encontrado.', 404);
		}

		this.invalidateTenantStorefrontCaches(updatedTenant);
		return this.getCatalogForTenant(updatedTenant);
	}

	/**
	 * Permite al comerciante guardar los settings visuales de su plantilla activa.
	 */
	static async updateTemplateSettingsForTenant(tenant: ITenant, rawSettings: Record<string, unknown>) {
		if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
			throw new AppError('Validation Error', 'El objeto settings es obligatorio.', 400);
		}

		const templates = await this.listAllTemplates(true);
		const summary = await this.buildTenantStorefrontSummary(tenant, templates);
		const activeKey = summary.activeTemplateKey;
		if (!activeKey) {
			throw new AppError('No active template', 'El comercio no tiene una plantilla activa seleccionada.', 400);
		}

		const activeTemplate = templates.find((t) => t.key === activeKey);
		const sanitizedSettings: Record<string, unknown> = { ...(tenant.templateSettings || {}) };

		if (activeTemplate?.customizableFields && activeTemplate.customizableFields.length > 0) {
			const fieldMap = new Map<string, ITemplateCustomizableField>(
				activeTemplate.customizableFields.map((f) => [f.key, f])
			);
			for (const [k, val] of Object.entries(rawSettings)) {
				const def = fieldMap.get(k);
				if (!def) continue;
				if (def.type === 'boolean' && typeof val === 'boolean') {
					sanitizedSettings[k] = val;
				} else if (def.type === 'select' && typeof val === 'string') {
					if (def.options && !def.options.includes(val)) {
						throw new AppError(
							'Invalid setting option',
							`El valor '${val}' no es válido para '${def.label}'. Opciones: ${def.options.join(', ')}.`,
							400
						);
					}
					sanitizedSettings[k] = val.trim();
				} else if ((def.type === 'string' || def.type === 'color') && typeof val === 'string') {
					sanitizedSettings[k] = val.trim();
				}
			}
		} else {
			Object.assign(sanitizedSettings, rawSettings);
		}

		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const updatedTenant = (await TenantModel.findByIdAndUpdate(
			tenant._id,
			{ $set: { templateSettings: sanitizedSettings } },
			{ new: true }
		).lean()) as ITenant | null;

		if (!updatedTenant) {
			throw new AppError('Tenant not found', 'Comercio no encontrado.', 404);
		}

		this.invalidateTenantStorefrontCaches(updatedTenant);
		return this.buildTenantStorefrontSummary(updatedTenant, templates);
	}

	/**
	 * Permite al comerciante (con addon custom_domain activo) vincular o cambiar su dominio propio.
	 */
	static async updateCustomDomainForTenant(
		tenant: ITenant,
		payload: { customDomain?: string | null; domainMode?: TenantDomainMode }
	) {
		const capabilities = tenant.planTier
			? getEffectivePlanCapabilities(tenant.planTier, tenant.businessType, tenant.activeAddons)
			: undefined;

		const cleanDomain = this.normalizeCustomDomain(payload.customDomain);
		const requestedMode: TenantDomainMode =
			payload.domainMode || (cleanDomain ? 'custom_domain' : 'vexx_subdomain');

		if ((cleanDomain || requestedMode === 'custom_domain') && !capabilities?.hasCustomDomain) {
			throw new AppError(
				'Custom domain addon required',
				'Necesitás el complemento Dominio Propio (incluido en Vexx PRO) para conectar un dominio externo.',
				403
			);
		}

		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		if (cleanDomain) {
			const duplicate = await TenantModel.findOne({
				_id: { $ne: tenant._id },
				domain: cleanDomain
			}).lean();
			if (duplicate) {
				throw new AppError(
					'Domain already in use',
					`El dominio '${cleanDomain}' ya está vinculado a otro comercio en Vexx.`,
					409
				);
			}
		}

		const updateDoc: Record<string, unknown> = {
			domainMode: cleanDomain ? requestedMode : 'vexx_subdomain'
		};

		const unsetDoc: Record<string, 1> = {};
		if (payload.customDomain === null || payload.customDomain === '') {
			unsetDoc.domain = 1;
		} else if (cleanDomain) {
			updateDoc.domain = cleanDomain;
		}

		const updatedTenant = (await TenantModel.findByIdAndUpdate(
			tenant._id,
			{
				$set: updateDoc,
				...(Object.keys(unsetDoc).length > 0 ? { $unset: unsetDoc } : {})
			},
			{ new: true }
		).lean()) as ITenant | null;

		if (!updatedTenant) {
			throw new AppError('Tenant not found', 'Comercio no encontrado.', 404);
		}

		this.invalidateTenantStorefrontCaches(updatedTenant, tenant.domain);
		await loadAllTenantOrigins();

		const summary = await this.buildTenantStorefrontSummary(updatedTenant);
		return {
			storefront: summary,
			dnsInstructions: cleanDomain
				? {
						domain: cleanDomain,
						records: [
							{
								type: 'CNAME',
								host: 'www',
								value: `cname.${this.getBaseDomain()}`,
								ttl: 3600
							},
							{
								type: 'A',
								host: '@',
								value: process.env.VEXX_INGRESS_IP || '76.76.21.21',
								ttl: 3600
							}
						]
				  }
				: undefined
		};
	}

	/**
	 * Permite al SuperAdmin desde console.vexx configurar plantilla activa, plantillas desbloqueadas
	 * y modo de dominio (subdominio gratuito vs dominio propio) de cualquier comercio.
	 */
	static async updateTenantStorefrontBySuperAdmin(tenantId: string, rawBody: unknown) {
		await this.ensureDefaultTemplatesSeeded();
		const parsed = SuperAdminUpdateTenantStorefrontZodSchema.parse(rawBody);

		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');
		const existingTenant = (await TenantModel.findById(tenantId).lean()) as ITenant | null;
		if (!existingTenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		const updateSet: Record<string, unknown> = {};
		const updateUnset: Record<string, 1> = {};

		const unlockedSet = new Set(
			(parsed.unlockedTemplates ?? existingTenant.unlockedTemplates ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean)
		);

		if (parsed.activeTemplateKey !== undefined) {
			if (parsed.activeTemplateKey === '') {
				updateUnset.activeTemplateKey = 1;
			} else {
				const tpl = await this.getTemplateByKey(parsed.activeTemplateKey);
				updateSet.activeTemplateKey = tpl.key;
				// Al asignarle una plantilla desde console.vexx, queda automáticamente desbloqueada para ese cliente
				unlockedSet.add(tpl.key);
			}
		}

		if (parsed.unlockedTemplates !== undefined || parsed.activeTemplateKey) {
			// Verificar que todas las plantillas en unlockedSet existan
			const templates = await this.listAllTemplates(true);
			const validKeys = new Set(templates.map((t) => t.key));
			for (const k of unlockedSet) {
				if (!validKeys.has(k)) {
					throw new AppError('Template not found', `La plantilla '${k}' no existe en el catálogo maestro.`, 404);
				}
			}
			updateSet.unlockedTemplates = Array.from(unlockedSet);
		}

		if (parsed.customDomain !== undefined) {
			if (parsed.customDomain === null || parsed.customDomain === '') {
				updateUnset.domain = 1;
				updateSet.domainMode = 'vexx_subdomain';
			} else {
				const cleanDomain = this.normalizeCustomDomain(parsed.customDomain)!;
				const duplicate = await TenantModel.findOne({
					_id: { $ne: existingTenant._id },
					domain: cleanDomain
				}).lean();
				if (duplicate) {
					throw new AppError(
						'Domain already in use',
						`El dominio '${cleanDomain}' ya está asignado al comercio '${duplicate.name}' (${duplicate.slug}).`,
						409
					);
				}
				updateSet.domain = cleanDomain;
				updateSet.domainMode = parsed.domainMode || 'custom_domain';
			}
		} else if (parsed.domainMode !== undefined) {
			if (parsed.domainMode === 'custom_domain' && !existingTenant.domain) {
				throw new AppError(
					'Missing custom domain',
					'Para activar el modo custom_domain debés especificar un dominio propio (customDomain).',
					400
				);
			}
			updateSet.domainMode = parsed.domainMode;
		}

		if (parsed.templateSettings !== undefined) {
			updateSet.templateSettings = parsed.templateSettings;
		}

		const updatedTenant = (await TenantModel.findByIdAndUpdate(
			tenantId,
			{
				...(Object.keys(updateSet).length > 0 ? { $set: updateSet } : {}),
				...(Object.keys(updateUnset).length > 0 ? { $unset: updateUnset } : {})
			},
			{ new: true }
		).lean()) as ITenant | null;

		if (!updatedTenant) {
			throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
		}

		this.invalidateTenantStorefrontCaches(updatedTenant, existingTenant.domain);
		await loadAllTenantOrigins();

		const summary = await this.buildTenantStorefrontSummary(updatedTenant);
		return {
			tenant: updatedTenant,
			storefront: summary
		};
	}

	static invalidateTenantStorefrontCaches(tenant: Pick<ITenant, 'slug' | 'domain' | 'apiKey'>, previousDomain?: string): void {
		connectionManager.invalidateTenantCache(tenant.slug);
		const baseDomain = this.getBaseDomain();
		connectionManager.invalidateTenantCache(`${tenant.slug}.${baseDomain}`);
		if (tenant.domain) {
			connectionManager.invalidateTenantCache(tenant.domain);
		}
		if (previousDomain) {
			connectionManager.invalidateTenantCache(previousDomain);
		}
		if (tenant.apiKey) {
			connectionManager.invalidateTenantCache(tenant.apiKey);
		}
		CacheService.invalidatePrefix(tenant.slug, 'config');
	}
}
