import { ZodError } from 'zod';
import { PlanCapabilities, VexxPlanTier } from '@/interfaces/plan.interface';
import { BusinessType } from '@/interfaces/tenant.interface';
import { AppError } from '@/errors/app.error';
import {
	AddonModule,
	PublicAddonCatalogItem,
	TenantAddonItem
} from './addon.types';
import { posAddon } from './pos';
import { cashRegisterAddon } from './cash_register';
import { storeManagementAddon } from './store_management';
import { storeIdentityAddon } from './store_identity';
import { salesControlAddon } from './sales_history';
import { dailySummaryAddon } from './daily_summary';
import { fiscalAuditAddon } from './fiscal_audit';
import { onlineOrdersAddon } from './online_orders';
import { categoryManagerAddon } from './category_manager';
import { weighableAddon } from './weighable';
import { arcaInvoicingAddon } from './arca_invoicing';
import { couponsAddon } from './coupons';
import { webCatalogAddon } from './web_catalog';
import { homeLayoutAddon } from './home_layout';
import { productBundlesAddon } from './product_bundles';
import { dataSetsAddon } from './data_sets';
import { metricDatasetsAddon } from './metric_datasets';
import { ecommerceWebAddon } from './ecommerce_web';
import { marketingBannersAddon } from './marketing_banners';
import { customDomainAddon } from './custom_domain';
import { storefrontTemplatesAddon } from './storefront_templates';
import { storefrontConnectionAddon } from './storefront_connection';
import { customerAuthAddon } from './customer_auth';
import { emailStudioAddon } from './email_studio';
import { metaMarketingAddon } from './meta_marketing';
import { googleAnalyticsAddon } from './google_analytics';
import { customerAccountsAddon } from './customer_accounts';
import { suppliersAddon } from './suppliers';
import { localDeliveryAddon } from './local_delivery';
import { newsletterAddon } from './newsletter';
import { variantsAddon } from './variants';
import { mediaStudioAddon } from './media_studio';
import { productDescriptionsAddon } from './product_descriptions';
import { techSpecsAddon } from './tech_specs';
import { sizeGuideAddon } from './size_guide';
import { productSeoAddon } from './product_seo';
import { crossSellStudioAddon } from './cross_sell_studio';
import { priceBuilderAddon } from './price_builder/priceBuilder.addon';
import { masterCatalogAddon } from './master_catalog';
import { thermalTicketsAddon } from './thermal_tickets';
import { expirationsAddon } from './expirations';
import { courierShippingAddon } from './courier_shipping';

export const ADDON_MODULES: readonly AddonModule[] = [
	storeIdentityAddon,
	storeManagementAddon,
	posAddon,
	cashRegisterAddon,
	salesControlAddon,
	dailySummaryAddon,
	customerAccountsAddon,
	suppliersAddon,
	categoryManagerAddon,
	localDeliveryAddon,
	weighableAddon,
	variantsAddon,
	mediaStudioAddon,
	productDescriptionsAddon,
	techSpecsAddon,
	sizeGuideAddon,
	productSeoAddon,
	crossSellStudioAddon,
	priceBuilderAddon,
	masterCatalogAddon,
	fiscalAuditAddon,
	arcaInvoicingAddon,
	couponsAddon,
	newsletterAddon,
	emailStudioAddon,
	metaMarketingAddon,
	googleAnalyticsAddon,
	webCatalogAddon,
	onlineOrdersAddon,
	homeLayoutAddon,
	productBundlesAddon,
	dataSetsAddon,
	metricDatasetsAddon,
	ecommerceWebAddon,
	storefrontTemplatesAddon,
	marketingBannersAddon,
	customDomainAddon,
	storefrontConnectionAddon,
	customerAuthAddon,
	// Borradores (visibles en catálogo como 'draft', pendientes de implementación)
	thermalTicketsAddon,
	expirationsAddon,
	courierShippingAddon
];

const ADDON_BY_ID = new Map<string, AddonModule>();

for (const mod of ADDON_MODULES) {
	ADDON_BY_ID.set(mod.manifest.id.toLowerCase(), mod);
	if (mod.manifest.aliases) {
		for (const alias of mod.manifest.aliases) {
			ADDON_BY_ID.set(alias.toLowerCase(), mod);
		}
	}
}

export function getAddonModule(idOrAlias: string): AddonModule | undefined {
	if (!idOrAlias || !idOrAlias.trim()) return undefined;
	return ADDON_BY_ID.get(idOrAlias.trim().toLowerCase());
}

export function normalizeActiveAddons(activeAddons: readonly string[] = []): string[] {
	const resolved = new Set<string>();
	for (const raw of activeAddons) {
		const mod = getAddonModule(raw);
		if (mod) {
			resolved.add(mod.manifest.id);
		}
	}
	return Array.from(resolved);
}

export function createEmptyCapabilities(): PlanCapabilities {
	return {
		hasPos: false,
		hasCashRegister: false,
		hasStockAndCostControl: false,
		hasScaleWeightPricing: false,
		hasCustomerAccounts: false,
		hasSupplierPurchases: false,
		hasTeamManagement: false,
		hasArcaBilling: false,
		hasInStorePaymentConfig: false,
		hasSalesHistory: false,
		hasDailySummary: false,
		hasFiscalAudit: false,
		hasCategoryManager: false,
		hasStoreIdentity: false,

		hasWebCatalog: false,
		hasOnlineOrders: false,
		hasThemeTemplates: false,
		hasCoupons: false,
		hasLocalDeliveryAndTakeaway: false,
		hasFeaturedProducts: false,
		hasStoreHoursAndStatus: false,
		hasSocialLinks: false,
		hasProductBundles: false,
		hasDataSets: false,
		hasHomeLayoutBuilder: false,
		hasCustomerAuthConfig: false,

		hasFullWebStore: false,
		hasCustomDomain: false,
		hasMarketingBanners: false,
		hasOnlinePaymentGateways: false,
		hasAutomatedShippingCouriers: false,
		hasProductFeeds: false,
		hasMetricDataSets: false,
		hasNewsletter: false,
		hasHeadlessApiKey: false,
		hasExternalIntegrations: false
	};
}

/**
 * Construye las capacidades efectivas EXCLUSIVAMENTE desde los módulos activos del comercio.
 * Si el SuperAdmin desactivó POS o Caja en un comercio 100% online, quedan en false.
 */
export function buildCapabilitiesFromAddons(activeAddons: readonly string[]): PlanCapabilities {
	const capabilities = createEmptyCapabilities();
	for (const rawId of activeAddons) {
		const mod = getAddonModule(rawId);
		if (!mod) continue;
		for (const capKey of mod.manifest.grantsCapabilities) {
			capabilities[capKey] = true;
		}
	}
	return capabilities;
}

/**
 * Devuelve los IDs sugeridos por defecto para un plan (útil como preset en el Wizard de SuperAdmin).
 */
export function getSuggestedAddonsForPlan(planTier: VexxPlanTier): string[] {
	return ADDON_MODULES
		.filter((mod) => mod.manifest.implementationStatus === 'ready' && mod.manifest.includedInPlans.includes(planTier))
		.map((mod) => mod.manifest.id);
}

const VERTICAL_EXTRA_SUGGESTED_ADDONS: Record<BusinessType, string[]> = {
	[BusinessType.KIOSK_GROCERY]: ['weighable', 'suppliers', 'master_catalog'],
	[BusinessType.BUTCHER]: ['weighable', 'product_bundles'],
	[BusinessType.BAKERY]: ['weighable', 'product_bundles'],
	[BusinessType.GASTRONOMY]: ['weighable', 'local_delivery'],
	[BusinessType.FASHION]: ['variants', 'media_studio', 'product_bundles', 'price_builder', 'size_guide', 'cross_sell_studio'],
	[BusinessType.TECH_ELECTRONICS]: ['variants', 'tech_specs', 'price_builder']
};

export function getSuggestedAddonsForSetup(planTier: VexxPlanTier, businessType?: BusinessType): string[] {
	const base = getSuggestedAddonsForPlan(planTier);
	const extra = businessType ? (VERTICAL_EXTRA_SUGGESTED_ADDONS[businessType] || []) : [];
	return normalizeActiveAddons([...base, ...extra]);
}

export function validateActiveAddonsForTenant(rawAddons: unknown): string[] {
	if (!Array.isArray(rawAddons)) {
		throw new AppError('Validation Error', 'El campo activeAddons debe ser un arreglo de IDs.', 400);
	}

	const normalized: string[] = [];
	const seen = new Set<string>();

	for (const raw of rawAddons) {
		if (typeof raw !== 'string' || !raw.trim()) {
			throw new AppError('Invalid addon', 'Cada complemento en activeAddons debe ser un string válido.', 400);
		}
		const mod = getAddonModule(raw);
		if (!mod) {
			throw new AppError('Addon not found', `El complemento '${raw}' no existe en el catálogo de Vexx.`, 400);
		}
		if (mod.manifest.implementationStatus === 'draft') {
			throw new AppError(
				'Addon in draft',
				`El complemento '${mod.manifest.name}' está en estado borrador y aún no se puede activar.`,
				400
			);
		}
		if (!seen.has(mod.manifest.id)) {
			seen.add(mod.manifest.id);
			normalized.push(mod.manifest.id);
		}
	}

	return normalized;
}

export function getPublicAddonCatalog(): PublicAddonCatalogItem[] {
	return ADDON_MODULES.map(({ manifest }) => {
		const { settingsSchema: _schema, aliases: _aliases, ...publicItem } = manifest;
		return publicItem;
	});
}

export function getTenantAddonStoreItems(
	activeAddons: readonly string[] = [],
	installedByAddonId: Record<string, { isConfigured?: boolean; settings?: Record<string, unknown> }> = {}
): TenantAddonItem[] {
	const activeSet = new Set(normalizeActiveAddons(activeAddons));

	return getPublicAddonCatalog().map((item) => {
		const isActive = activeSet.has(item.id);
		const record = installedByAddonId[item.id];
		const isConfigured = item.requiresSetup ? Boolean(record?.isConfigured) : true;
		const status: TenantAddonItem['status'] = !isActive
			? 'available'
			: isConfigured
				? 'active'
				: 'pending_setup';

		const defaultSettings: Record<string, unknown> = {};
		for (const def of item.configurableSettings || []) {
			defaultSettings[def.key] = def.defaultValue;
		}
		const mergedSettings = {
			...defaultSettings,
			...(record?.settings || {})
		};

		return {
			...item,
			isActive,
			isConfigured,
			status,
			...(Object.keys(mergedSettings).length > 0 ? { settings: mergedSettings } : {})
		};
	});
}

export function validateAddonSettings(addonId: string, payload: unknown): Record<string, unknown> {
	const mod = getAddonModule(addonId);
	if (!mod) {
		throw new AppError('Addon not found', `El complemento '${addonId}' no existe en el catálogo de Vexx.`, 404);
	}
	if (!mod.manifest.settingsSchema) {
		return (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
	}

	try {
		const parsed = mod.manifest.settingsSchema.parse(payload);
		return (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
	} catch (error) {
		if (error instanceof ZodError) {
			const firstIssue = error.issues[0];
			const fieldPath = firstIssue?.path?.join('.') || 'settings';
			throw new AppError(
				'Invalid addon settings',
				`Configuración inválida en '${mod.manifest.name}' (${fieldPath}): ${firstIssue?.message || 'datos inválidos'}`,
				400
			);
		}
		throw error;
	}
}

export async function runProductAddonValidationHooks(
	activeAddons: readonly string[] = [],
	payload: Record<string, unknown>,
	installedSettings: Record<string, Record<string, unknown>> = {}
): Promise<void> {
	const normalizedIds = normalizeActiveAddons(activeAddons);
	for (const addonId of normalizedIds) {
		const mod = getAddonModule(addonId);
		if (mod?.hooks?.beforeProductValidate) {
			await mod.hooks.beforeProductValidate(payload, installedSettings[addonId]);
		}
	}
}
