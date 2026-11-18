import { TenantModels } from '@/config/modelRegistry';
import { ITenant } from '@/interfaces/tenant.interface';
import { getEffectivePlanCapabilities, getEffectiveMaxEmployees } from '@/config/planCapabilities';
import { getTenantAddonStoreItems, getPublicAddonCatalog } from '@/addons/registry';
import {
	getEcommerceListValues,
	mergeUniqueOptionLists,
	resolveProductFormConfig,
	resolveProductListViewConfig,
	VerticalPresetFormOverride
} from '@/config/formCapabilities';
import { EcommerceService } from '@/services/ecommerce.service';
import { StorefrontTemplateService } from '@/services/storefrontTemplate.service';
import { validateTenantSubscriptionIntegrity } from '@/middleware/planGuard';
import { connectionManager } from '@/config/multitenancy';
import { buildPermissionCatalogForAddons } from '@/config/permissionCatalog';

const DEFAULT_VERTICAL_COLORS: Record<string, string> = {
	kiosk_grocery: '#059669',
	fashion: '#7C3AED',
	butcher: '#DC2626',
	bakery: '#D97706',
	tech_electronics: '#0284C7',
	gastronomy: '#EA580C'
};

export interface BootstrapUserInput {
	_id: unknown;
	name: string;
	lastName?: string;
	email: string;
	role: string;
	position?: string;
	permissions?: string[];
}

export class TenantBootstrapService {
	/**
	 * Construye el payload completo de arranque (/api/tenant/bootstrap) para un comercio y usuario.
	 * Usado tanto por TenantBootstrapController como por el monitor de salud en /api/master.
	 */
	static async buildBootstrapPayload(models: TenantModels, tenant: ITenant, user: BootstrapUserInput) {
		validateTenantSubscriptionIntegrity(tenant);

		const planTier = tenant.planTier;
		const businessType = tenant.businessType;
		const explicitAddons = tenant.activeAddons;
		const activeAddons = explicitAddons || [];
		const customLabels = tenant.customLabels
			? (tenant.customLabels instanceof Map
				? Object.fromEntries(tenant.customLabels)
				: (tenant.customLabels as Record<string, string>))
			: {};
		const tenantAddonLabels = (tenant.addonLabels || {}) as Record<string, Record<string, string>>;

		let presetAddonLabels: Record<string, Record<string, string>> = {};
		let presetAddonSettings: Record<string, Record<string, unknown>> = {};
		let presetOverride: VerticalPresetFormOverride | undefined;
		try {
			const presetDoc = await connectionManager
				.getMasterDb()
				.collection('vertical_presets')
				.findOne(
					{ key: businessType },
					{ projection: { addonLabels: 1, addonSettings: 1, variantMode: 1, variantColumns: 1, defaultAspectRatios: 1 } }
				);
			if (presetDoc) {
				if (presetDoc.addonLabels && typeof presetDoc.addonLabels === 'object') {
					presetAddonLabels = presetDoc.addonLabels as Record<string, Record<string, string>>;
				}
				if (presetDoc.addonSettings && typeof presetDoc.addonSettings === 'object') {
					presetAddonSettings = presetDoc.addonSettings as Record<string, Record<string, unknown>>;
				}
				presetOverride = {
					variantMode: presetDoc.variantMode,
					variantColumns: presetDoc.variantColumns,
					defaultAspectRatios: presetDoc.defaultAspectRatios
				};
			}
		} catch {
			// Si masterDb no está conectado (ej. tests unitarios aislados), se usan defaults de manifest y tenant.
		}

		// Cruce Addon-First: defaultValue (manifest) -> preset del rubro -> override del tenant
		const resolvedAddonLabels: Record<string, Record<string, string>> = {};
		const flattenedAddonLabels: Record<string, string> = {};
		for (const addonItem of getPublicAddonCatalog()) {
			const merged: Record<string, string> = {};
			for (const def of addonItem.configurableLabels || []) {
				merged[def.key] = def.defaultValue;
			}
			Object.assign(merged, presetAddonLabels[addonItem.id] || {});
			Object.assign(merged, tenantAddonLabels[addonItem.id] || {});
			if (Object.keys(merged).length > 0) {
				resolvedAddonLabels[addonItem.id] = merged;
				Object.assign(flattenedAddonLabels, merged);
			}
		}
		const effectiveCustomLabels: Record<string, string> = {
			...flattenedAddonLabels,
			...customLabels
		};

		const installations = await models.AddonInstallation.find().lean();
		const installedMap: Record<string, { isConfigured?: boolean; settings?: Record<string, unknown> }> = {};
		for (const [addonId, presetSettings] of Object.entries(presetAddonSettings)) {
			if (presetSettings && typeof presetSettings === 'object') {
				installedMap[addonId] = {
					isConfigured: true,
					settings: { ...presetSettings }
				};
			}
		}
		for (const inst of installations) {
			installedMap[inst.addonId] = {
				isConfigured: inst.isConfigured,
				settings: {
					...(installedMap[inst.addonId]?.settings || {}),
					...(inst.settings || {})
				}
			};
		}

		const descSettings = (installedMap.product_descriptions?.settings || installedMap.description_builder?.settings) as
			| VerticalPresetFormOverride['descriptionSettings']
			| undefined;
		const mediaSettings = (installedMap.media_studio?.settings || installedMap.product_gallery?.settings) as
			| VerticalPresetFormOverride['mediaSettings']
			| undefined;
		const variantSettings = (installedMap.variants?.settings || installedMap.variant_studio?.settings) as
			| VerticalPresetFormOverride['variantSettings']
			| undefined;
		const weighableSettings = installedMap.weighable?.settings as
			| VerticalPresetFormOverride['weighableSettings']
			| undefined;
		const detailsSettings = (installedMap.details_builder?.settings || installedMap.tech_specs?.settings || installedMap.product_details?.settings) as
			| VerticalPresetFormOverride['detailsSettings']
			| undefined;
		const sizeGuideSettings = installedMap.size_guide?.settings as
			| VerticalPresetFormOverride['sizeGuideSettings']
			| undefined;
		const webCatalogSettings = installedMap.web_catalog?.settings as
			| VerticalPresetFormOverride['webCatalogSettings']
			| undefined;
		const seoSettings = (installedMap.product_seo?.settings || installedMap.seo_pro?.settings || installedMap.ecommerce_web?.settings) as
			| VerticalPresetFormOverride['seoSettings']
			| undefined;
		const crossSellSettings = (installedMap.cross_sell_studio?.settings || installedMap.cross_sell?.settings || installedMap.shop_the_look?.settings) as
			| VerticalPresetFormOverride['crossSellSettings']
			| undefined;

		if (descSettings || mediaSettings || variantSettings || weighableSettings || detailsSettings || sizeGuideSettings || webCatalogSettings || seoSettings || crossSellSettings) {
			presetOverride = {
				...(presetOverride || {}),
				...(descSettings ? { descriptionSettings: descSettings } : {}),
				...(mediaSettings ? { mediaSettings } : {}),
				...(variantSettings ? { variantSettings } : {}),
				...(weighableSettings ? { weighableSettings } : {}),
				...(detailsSettings ? { detailsSettings } : {}),
				...(sizeGuideSettings ? { sizeGuideSettings } : {}),
				...(webCatalogSettings ? { webCatalogSettings } : {}),
				...(seoSettings ? { seoSettings } : {}),
				...(crossSellSettings ? { crossSellSettings } : {})
			};
		}

		const effectiveCapabilities = getEffectivePlanCapabilities(planTier, businessType, explicitAddons);
		const [storeConfig, storefront] = await Promise.all([
			EcommerceService.getConfig(models, tenant),
			StorefrontTemplateService.buildTenantStorefrontSummary(tenant)
		]);

		const acceptsInstallments = Boolean(storeConfig.pricingStrategy?.absorbInstallments);
		const formConfig = resolveProductFormConfig(businessType, planTier, acceptsInstallments, explicitAddons, effectiveCustomLabels, presetOverride);
		if (formConfig.sizeGuideConfig.addonEnabled && Array.isArray(storeConfig?.sizeGuideTemplates)) {
			formConfig.sizeGuideConfig.templates = storeConfig.sizeGuideTemplates;
		}

		// Merge automático de opciones globales (optionsSource) + preset + aprendidas en Product.specifications
		const merchantOptionKeys = formConfig.detailsConfig.addonEnabled
			? formConfig.detailsConfig.specFields
				.filter((f) => f.inputType === 'select' && (f.allowMerchantAddOption || f.optionsSource))
				.map((f) => f.key)
			: [];
		const learnedByKey = new Map<string, string[]>();
		if (merchantOptionKeys.length > 0) {
			const learnedRows = await models.Product.aggregate<{ _id: string; values: string[] }>([
				{ $match: { 'specifications.key': { $in: merchantOptionKeys } } },
				{ $unwind: '$specifications' },
				{ $match: { 'specifications.key': { $in: merchantOptionKeys }, 'specifications.value': { $type: 'string', $ne: '' } } },
				{ $group: { _id: '$specifications.key', values: { $addToSet: '$specifications.value' } } }
			]);
			for (const r of learnedRows) {
				learnedByKey.set(r._id, r.values);
			}
		}
		if (formConfig.detailsConfig.addonEnabled) {
			for (const field of formConfig.detailsConfig.specFields) {
				if (field.inputType !== 'select') continue;
				const globalSourceOpts = field.optionsSource ? getEcommerceListValues(storeConfig, field.optionsSource) : [];
				const learnedOpts = field.allowMerchantAddOption ? learnedByKey.get(field.key) : [];
				if (globalSourceOpts.length > 0 || (learnedOpts && learnedOpts.length > 0)) {
					field.options = mergeUniqueOptionLists(globalSourceOpts, field.options, learnedOpts);
				}
			}
		}

		const productListViewConfig = resolveProductListViewConfig(businessType, planTier, explicitAddons, effectiveCustomLabels);
		const maxEmployeesAllowed = getEffectiveMaxEmployees(planTier, tenant.extraEmployeesPurchased);

		const isAdmin = user.role === 'admin';
		const permissions = isAdmin ? ['*'] : (user.permissions || []);
		const addons = getTenantAddonStoreItems(activeAddons, installedMap).map((addon) => ({
			...addon,
			...(resolvedAddonLabels[addon.id] ? { labels: resolvedAddonLabels[addon.id] } : {})
		}));

		const modules: Record<
			string,
			{
				enabled: boolean;
				settings: Record<string, unknown>;
				labels: Record<string, string>;
			}
		> = {};
		for (const addon of addons) {
			modules[addon.id] = {
				enabled: addon.isActive,
				settings: (addon.settings || {}) as Record<string, unknown>,
				labels: addon.labels || {}
			};
		}

		const navigation = TenantBootstrapService.buildNavigationStructure(
			businessType,
			modules,
			effectiveCapabilities,
			effectiveCustomLabels,
			isAdmin,
			permissions
		);
		const permissionCatalog = buildPermissionCatalogForAddons(activeAddons);

		return {
			user: {
				_id: user._id,
				name: user.name,
				lastName: user.lastName,
				email: user.email,
				role: user.role,
				position: user.position,
				permissions,
				isAdmin
			},
			tenant: {
				name: tenant.name,
				slug: tenant.slug,
				businessType,
				planTier,
				activeAddons,
				customLabels: effectiveCustomLabels,
				addonLabels: resolvedAddonLabels,
				maxEmployeesAllowed,
				extraEmployeesPurchased: tenant.extraEmployeesPurchased || 0
			},
			capabilities: effectiveCapabilities,
			addons,
			modules,
			navigation,
			permissionCatalog,
			forms: {
				product: formConfig
			},
			views: {
				productList: productListViewConfig
			},
			store: {
				name: storeConfig?.name || tenant.name,
				logo: storeConfig?.logo || tenant.settings?.logo,
				customDomain: storefront.customDomain,
				publicUrl: storefront.primaryStorefrontUrl,
				posConfig: storeConfig?.posConfig || {},
				authConfig: storeConfig?.authConfig || {
					allowEmailPassword: true,
					allowMagicCode: true,
					allowGoogle: true,
					defaultMethod: 'google'
				},
				pricingStrategy: {
					priceRoundingMode: storeConfig?.pricingStrategy?.priceRoundingMode || '100'
				},
				customLists: storeConfig?.customLists || {}
			},
			storefront,
			theme: {
				primary: tenant.settings?.primaryColor || (businessType ? DEFAULT_VERTICAL_COLORS[businessType] : undefined) || '#059669',
				primaryContent: '#FFFFFF',
				businessType
			}
		};
	}

	/**
	 * Construye la estructura de navegación dinámica (Menú Lateral y Pestañas de Configuración)
	 * gobernada 100% por los Addons activos, sus settings (Manifest -> Rubro -> Cliente), labels y permisos del usuario.
	 */
	private static buildNavigationStructure(
		businessType: string | undefined,
		modules: Record<string, { enabled: boolean; settings: Record<string, unknown>; labels: Record<string, string> }>,
		capabilities: ReturnType<typeof getEffectivePlanCapabilities>,
		customLabels: Record<string, string> = {},
		isAdmin = true,
		permissions: string[] = ['*']
	) {
		const isEnabled = (addonId: string, fallbackCap?: boolean): boolean => {
			if (addonId in modules) {
				return Boolean(modules[addonId]?.enabled);
			}
			return Boolean(fallbackCap);
		};

		const getSetting = <T>(addonId: string, key: string, defaultVal: T): T => {
			const val = modules[addonId]?.settings?.[key];
			return (val !== undefined ? val : defaultVal) as T;
		};

		const getLabel = (addonId: string, key: string, defaultVal: string): string => {
			return modules[addonId]?.labels?.[key] || customLabels[key] || defaultVal;
		};

		const hasAccess = (adminOnlyItem: boolean, requiredPermission?: string, allowEmployeeOverride = false): boolean => {
			if (isAdmin || permissions.includes('*')) return true;
			if (allowEmployeeOverride) return true;
			if (requiredPermission && permissions.includes(requiredPermission)) return true;
			return !adminOnlyItem;
		};

		const verticalListsTabDefaultLabel: Record<string, string> = {
			fashion: 'Indumentaria & Medidas',
			tech_electronics: 'Atributos & Listas Tech',
			kiosk_grocery: 'Listas & Presentaciones',
			butcher: 'Cortes & Presentaciones',
			bakery: 'Listas & Variedades',
			gastronomy: 'Carta & Opciones'
		};

		const allowStaffDailySummary = getSetting('daily_summary', 'allowStaffViewDailySummary', false);

		const sidebarGroups = [
			{
				groupKey: 'metrics',
				groupLabel: 'MÉTRICAS',
				items: [
					{
						key: 'sales_control',
						addonId: 'sales_control',
						label: getLabel('sales_control', 'salesModuleTitle', 'Ventas'),
						route: '/home/sales',
						icon: 'bar_chart',
						adminOnly: false,
						requiredPermission: 'sales:view',
						enabled: isEnabled('sales_control', capabilities.hasSalesHistory) && hasAccess(false, 'sales:view'),
						actions: {
							enablePdfTicketDownload: getSetting('sales_control', 'enablePdfTicketDownload', true),
							allowEmployeeCancelSale: getSetting('sales_control', 'allowEmployeeCancelSale', false),
							showChannelBreakdown: getSetting('sales_control', 'showChannelBreakdown', true)
						}
					},
					{
						key: 'daily_summary',
						addonId: 'daily_summary',
						label: getLabel('daily_summary', 'dailySummaryTitle', 'Resumen Diario'),
						route: '/home/daily-reports',
						icon: 'calendar_today',
						adminOnly: !allowStaffDailySummary,
						requiredPermission: 'analytics:daily_summary',
						enabled:
							isEnabled('daily_summary', capabilities.hasDailySummary) &&
							hasAccess(!allowStaffDailySummary, 'analytics:daily_summary', allowStaffDailySummary),
						actions: {
							showNetProfitInSummary: getSetting('daily_summary', 'showNetProfitInSummary', true),
							showPaymentMethodBreakdown: getSetting('daily_summary', 'showPaymentMethodBreakdown', true),
							allowStaffViewDailySummary: allowStaffDailySummary
						}
					},
					{
						key: 'fiscal_audit',
						addonId: 'fiscal_audit',
						label: getLabel('fiscal_audit', 'fiscalAuditTitle', 'ARCA & Fiscal'),
						route: '/home/fiscal',
						icon: 'account_balance',
						adminOnly: true,
						requiredPermission: 'fiscal:manage',
						enabled:
							(isEnabled('fiscal_audit', capabilities.hasFiscalAudit) ||
								isEnabled('arca_invoicing', capabilities.hasArcaBilling)) &&
							hasAccess(true, 'fiscal:manage'),
						actions: {
							enableRecategorizationAlerts: getSetting('fiscal_audit', 'enableRecategorizationAlerts', true),
							alertThresholdPercent: getSetting('fiscal_audit', 'alertThresholdPercent', 80),
							hasElectronicInvoicing: isEnabled('arca_invoicing', capabilities.hasArcaBilling)
						}
					}
				].filter((i) => i.enabled)
			},
			{
				groupKey: 'sales_and_pos',
				groupLabel: 'VENTAS & POS',
				items: [
					{
						key: 'online_orders',
						addonId: 'online_orders',
						label: getLabel('online_orders', 'onlineOrdersTitle', 'Pedidos Online'),
						route: '/home/client-orders',
						icon: 'shopping_cart',
						adminOnly: false,
						requiredPermission: 'orders:manage',
						enabled: isEnabled('online_orders', capabilities.hasOnlineOrders) && hasAccess(false, 'orders:manage'),
						actions: {
							requireReceiptForTransferOrder: getSetting('online_orders', 'requireReceiptForTransferOrder', true),
							enableGuestOrderTracking: getSetting('online_orders', 'enableGuestOrderTracking', true)
						}
					},
					{
						key: 'pos',
						addonId: 'pos',
						label: getLabel('pos', 'posModuleTitle', 'Mostrador (POS)'),
						route: '/home/pos',
						icon: 'point_of_sale',
						adminOnly: false,
						requiredPermission: 'pos:access',
						enabled: isEnabled('pos', capabilities.hasPos) && hasAccess(false, 'pos:access'),
						actions: {
							allowManualDiscount: getSetting('pos', 'allowManualDiscount', true),
							autoPrintReceipt: getSetting('pos', 'autoPrintReceipt', false),
							enableMobileBarcodeScanner: getSetting('pos', 'enableMobileBarcodeScanner', true),
							enablePointTerminalIntegration: getSetting('pos', 'enablePointTerminalIntegration', true)
						}
					},
					{
						key: 'cash_register',
						addonId: 'cash_register',
						label: getLabel('cash_register', 'cashRegisterTitle', 'Caja Registradora'),
						route: '/home/cash-register',
						icon: 'payments',
						adminOnly: false,
						requiredPermission: 'cash:open_close',
						enabled: isEnabled('cash_register', capabilities.hasCashRegister) && hasAccess(false, 'cash:open_close'),
						actions: {
							requireOpeningCashToSell: getSetting('cash_register', 'requireOpeningCashToSell', true),
							blindCashCountOnClose: getSetting('cash_register', 'blindCashCountOnClose', false),
							allowCashWithdrawals: getSetting('cash_register', 'allowCashWithdrawals', true)
						}
					},
					{
						key: 'customer_accounts',
						addonId: 'customer_accounts',
						label: getLabel('customer_accounts', 'customersModuleTitle', 'Clientes'),
						route: '/home/clients',
						icon: 'group',
						adminOnly: true,
						requiredPermission: 'customers:read',
						enabled: isEnabled('customer_accounts', capabilities.hasCustomerAccounts) && hasAccess(true, 'customers:read'),
						actions: {
							allowQuickClientCreationInPos: getSetting('customer_accounts', 'allowQuickClientCreationInPos', true),
							enableCreditLineAndFiados: getSetting('customer_accounts', 'enableCreditLineAndFiados', true)
						}
					}
				].filter((i) => i.enabled)
			},
			{
				groupKey: 'catalog',
				groupLabel: 'CATÁLOGO',
				items: [
					{
						key: 'products',
						addonId: 'store_management',
						label: 'Productos',
						route: '/home/products',
						icon: 'inventory_2',
						adminOnly: false,
						requiredPermission: 'products:read_prices',
						enabled: isEnabled('store_management', capabilities.hasStockAndCostControl) && hasAccess(false, 'products:read_prices'),
						actions: {
							showDataSetsTab: isEnabled('data_sets', capabilities.hasDataSets),
							showProductBundlesTab: isEnabled('product_bundles', capabilities.hasProductBundles),
							allowMetricFiltersInDataSets: isEnabled('metric_datasets', capabilities.hasMetricDataSets)
						}
					},
					{
						key: 'product_bundles',
						addonId: 'product_bundles',
						label: getLabel('product_bundles', 'bundleTitle', 'Conjuntos de Productos'),
						route: '/home/product-bundles',
						icon: 'Layers',
						adminOnly: false,
						requiredPermission: 'products:create_edit',
						enabled: isEnabled('product_bundles', capabilities.hasProductBundles) && hasAccess(false, 'products:create_edit')
					},
					{
						key: 'data_sets',
						addonId: 'data_sets',
						label: 'Conjuntos de Datos',
						route: '/home/data-sets',
						icon: 'filter_list',
						adminOnly: false,
						requiredPermission: 'products:create_edit',
						enabled: isEnabled('data_sets', capabilities.hasDataSets) && hasAccess(false, 'products:create_edit'),
						actions: {
							allowMetricFiltersInDataSets: isEnabled('metric_datasets', capabilities.hasMetricDataSets)
						}
					},
					{
						key: 'category_manager',
						addonId: 'category_manager',
						label: getLabel('category_manager', 'categoriesTitle', 'Categorías'),
						route: '/home/categories',
						icon: 'category',
						adminOnly: false,
						requiredPermission: 'categories:manage',
						enabled: isEnabled('category_manager', capabilities.hasCategoryManager) && hasAccess(false, 'categories:manage'),
						actions: {
							enableHierarchicalCategoryGroups: getSetting('category_manager', 'enableHierarchicalCategoryGroups', true),
							enableBrandsCatalog: getSetting('category_manager', 'enableBrandsCatalog', true),
							showCategoryProductCount: getSetting('category_manager', 'showCategoryProductCount', true)
						}
					},
					{
						key: 'suppliers',
						addonId: 'suppliers',
						label: getLabel('suppliers', 'suppliersModuleTitle', 'Proveedores'),
						route: '/home/providers',
						icon: 'local_shipping',
						adminOnly: true,
						requiredPermission: 'suppliers:manage',
						enabled: isEnabled('suppliers', capabilities.hasSupplierPurchases) && hasAccess(true, 'suppliers:manage'),
						actions: {
							showProviderUrlInProduct: getSetting('suppliers', 'showProviderUrlInProduct', true),
							trackLastPurchaseCost: getSetting('suppliers', 'trackLastPurchaseCost', true)
						}
					}
				].filter((i) => i.enabled)
			},
			{
				groupKey: 'marketing_and_design',
				groupLabel: 'MARKETING & DISEÑO',
				items: [
					{
						key: 'storefront_templates',
						addonId: 'storefront_templates',
						label: 'Tienda Vexx & Plantillas',
						route: '/home/templates',
						icon: 'palette',
						adminOnly: true,
						requiredPermission: 'settings:manage',
						enabled: isEnabled('storefront_templates', capabilities.hasThemeTemplates) && hasAccess(true, 'settings:manage')
					},
					{
						key: 'home_layout',
						addonId: 'home_layout',
						label: getLabel('home_layout', 'homeBuilderTitle', 'Diseño del Home'),
						route: '/home/home-layout',
						icon: 'dashboard_customize',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled: isEnabled('home_layout', capabilities.hasHomeLayoutBuilder) && hasAccess(true, 'marketing:manage')
					},
					{
						key: 'promo_banners',
						addonId: 'marketing_banners',
						label: 'Banners',
						route: '/home/banners',
						icon: 'view_carousel',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled:
							isEnabled('marketing_banners', capabilities.hasMarketingBanners) &&
							getSetting('marketing_banners', 'enablePromoBanners', true) &&
							hasAccess(true, 'marketing:manage')
					},
					{
						key: 'hero_sliders',
						addonId: 'marketing_banners',
						label: getLabel('marketing_banners', 'heroSlidersTitle', 'Hero Slider'),
						route: '/home/hero',
						icon: 'slideshow',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled:
							isEnabled('marketing_banners', capabilities.hasMarketingBanners) &&
							getSetting('marketing_banners', 'enableHeroSliders', true) &&
							hasAccess(true, 'marketing:manage'),
						actions: {
							maxHeroSlides: getSetting('marketing_banners', 'maxHeroSlides', 6)
						}
					},
					{
						key: 'bento_menus',
						addonId: 'marketing_banners',
						label: getLabel('marketing_banners', 'bentoMenusTitle', 'Menús Bento'),
						route: '/home/menus',
						icon: 'grid_view',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled:
							isEnabled('marketing_banners', capabilities.hasMarketingBanners) &&
							getSetting('marketing_banners', 'enableBentoMenus', true) &&
							hasAccess(true, 'marketing:manage')
					},
					{
						key: 'coupons',
						addonId: 'coupons',
						label: getLabel('coupons', 'couponsModuleTitle', 'Cupones'),
						route: '/home/coupons',
						icon: 'confirmation_number',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled: isEnabled('coupons', capabilities.hasCoupons) && hasAccess(true, 'marketing:manage'),
						actions: {
							allowCouponsInPos: getSetting('coupons', 'allowCouponsInPos', true),
							allowCouponsInStorefront: getSetting('coupons', 'allowCouponsInStorefront', true),
							allowFirstPurchaseDiscount: getSetting('coupons', 'allowFirstPurchaseDiscount', true)
						}
					},
					{
						key: 'newsletter',
						addonId: 'newsletter',
						label: 'Newsletter',
						route: '/home/subscribers',
						icon: 'mail',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled: isEnabled('newsletter', capabilities.hasNewsletter) && hasAccess(true, 'marketing:manage'),
						actions: {
							showFooterSubscription: getSetting('newsletter', 'showFooterSubscription', true),
							enableSubscriberExportCsv: getSetting('newsletter', 'enableSubscriberExportCsv', true)
						}
					},
					{
						key: 'favorites',
						addonId: 'favorites',
						label: 'Favoritos & Stock',
						route: '/home/favorites',
						icon: 'favorite',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled: isEnabled('favorites', capabilities.hasFavorites) && hasAccess(true, 'marketing:manage'),
						actions: {
							enableBackInStockNotifications: getSetting('favorites', 'enableBackInStockNotifications', true),
							showFavoriteCountInStorefront: getSetting('favorites', 'showFavoriteCountInStorefront', false)
						}
					},
					{
						key: 'email_studio',
						addonId: 'email_studio',
						label: getLabel('email_studio', 'emailStudioTitle', 'Emails & Plantillas'),
						route: '/home/emails',
						icon: 'mark_email_read',
						adminOnly: true,
						requiredPermission: 'marketing:manage',
						enabled: isEnabled('email_studio', capabilities.hasExternalIntegrations) && hasAccess(true, 'marketing:manage')
					},
					{
						key: 'shipping_options',
						addonId: 'local_delivery',
						label: 'Opciones de Envío',
						route: '/home/shipping-options',
						icon: 'local_shipping',
						adminOnly: true,
						requiredPermission: 'settings:manage',
						enabled:
							(isEnabled('local_delivery', capabilities.hasLocalDeliveryAndTakeaway) ||
								isEnabled('courier_shipping', capabilities.hasAutomatedShippingCouriers)) &&
							hasAccess(true, 'settings:manage')
					}
				].filter((i) => i.enabled)
			},
			{
				groupKey: 'settings',
				groupLabel: 'CONFIGURACIÓN',
				items: [
					{
						key: 'store_settings',
						addonId: 'store_identity',
						label: 'Ajustes de Tienda',
						route: '/home/settings',
						icon: 'settings',
						adminOnly: true,
						requiredPermission: 'settings:manage',
						enabled: hasAccess(true, 'settings:manage')
					},
					{
						key: 'addons_catalog',
						addonId: 'store_management',
						label: 'Complementos',
						route: '/home/addons',
						icon: 'extension',
						adminOnly: true,
						requiredPermission: 'settings:manage',
						enabled: hasAccess(true, 'settings:manage')
					},
					{
						key: 'staff_management',
						addonId: 'store_management',
						label: 'Equipo & Empleados',
						route: '/home/staff',
						icon: 'badge',
						adminOnly: true,
						requiredPermission: 'staff:manage',
						enabled: isEnabled('store_management', capabilities.hasTeamManagement) && hasAccess(true, 'staff:manage')
					}
				].filter((i) => i.enabled)
			}
		].filter((g) => g.items.length > 0);

		const settingsTabs = [
			{
				tabKey: 'identity_and_contact',
				addonId: 'store_identity',
				label: getLabel('store_identity', 'identitySectionTitle', 'Identidad, Contacto & Redes'),
				icon: 'store',
				adminOnly: true,
				enabled: isEnabled('store_identity', capabilities.hasStoreIdentity) && hasAccess(true, 'settings:manage'),
				sections: {
					showBasicIdentity: true,
					showContactAndAddress: true,
					showWhatsappContact: getSetting('store_identity', 'showWhatsappContact', true),
					showWorkingHoursConfig: getSetting('store_identity', 'showWorkingHoursConfig', true),
					showSocialLinksConfig: getSetting('store_identity', 'showSocialLinksConfig', true)
				}
			},
			{
				tabKey: 'pricing_and_gateways',
				addonId: 'price_builder',
				label: 'Precios & Pasarelas de Cobro',
				icon: 'payments',
				adminOnly: true,
				enabled:
					(isEnabled('price_builder', true) ||
						isEnabled('pos', capabilities.hasPos) ||
						isEnabled('ecommerce_web', capabilities.hasOnlinePaymentGateways)) &&
					hasAccess(true, 'settings:manage'),
				sections: {
					showGlobalMarginsAndRounding: true,
					showMercadoPagoConfig: true,
					showGetnetConfig: isEnabled('ecommerce_web', capabilities.hasOnlinePaymentGateways),
					showBankTransferConfig: true
				}
			},
			{
				tabKey: 'fiscal_and_arca',
				addonId: 'fiscal_audit',
				label: 'Fiscal & ARCA',
				icon: 'account_balance',
				adminOnly: true,
				enabled:
					(isEnabled('fiscal_audit', capabilities.hasFiscalAudit) ||
						isEnabled('arca_invoicing', capabilities.hasArcaBilling)) &&
					hasAccess(true, 'settings:manage'),
				sections: {
					showTaxRegimeAndMonotributo: isEnabled('fiscal_audit', capabilities.hasFiscalAudit),
					showArcaCertificatesAndPtoVta: isEnabled('arca_invoicing', capabilities.hasArcaBilling)
				}
			},
			{
				tabKey: 'pos_and_register',
				addonId: 'pos',
				label: 'Mostrador & POS',
				icon: 'point_of_sale',
				adminOnly: true,
				enabled:
					(isEnabled('pos', capabilities.hasPos) || isEnabled('cash_register', capabilities.hasCashRegister)) &&
					hasAccess(true, 'settings:manage'),
				sections: {
					showTransferValidationMode: isEnabled('pos', capabilities.hasPos),
					showCashRegisterRules: isEnabled('cash_register', capabilities.hasCashRegister),
					showScannerAndPointSettings: isEnabled('pos', capabilities.hasPos)
				}
			},
			{
				tabKey: 'storefront_and_connection',
				addonId: 'storefront_templates',
				label: 'Tienda Web, Plantillas & API Key',
				icon: 'language',
				adminOnly: true,
				enabled:
					(isEnabled('storefront_templates', capabilities.hasThemeTemplates) ||
						isEnabled('custom_domain', capabilities.hasCustomDomain) ||
						isEnabled('storefront_connection', capabilities.hasHeadlessApiKey)) &&
					hasAccess(true, 'settings:manage'),
				sections: {
					showTemplateSelectorAndSettings: isEnabled('storefront_templates', capabilities.hasThemeTemplates),
					showVexxSubdomainInfo: isEnabled('web_catalog', capabilities.hasWebCatalog),
					showCustomDomainSetup: isEnabled('custom_domain', capabilities.hasCustomDomain),
					showHeadlessApiKeyAndCors: isEnabled('storefront_connection', capabilities.hasHeadlessApiKey),
					allowMerchantRegenerateApiKey: getSetting('storefront_connection', 'allowMerchantRegenerateApiKey', true),
					allowMerchantEditAllowedOrigins: getSetting('storefront_connection', 'allowMerchantEditAllowedOrigins', true)
				}
			},
			{
				tabKey: 'vertical_custom_lists',
				addonId: 'details_builder',
				label:
					getLabel('details_builder', 'settingsTabTitle', '') ||
					(businessType && verticalListsTabDefaultLabel[businessType]) ||
					'Listas & Plantillas de Producto',
				icon: 'tune',
				adminOnly: true,
				enabled: (isEnabled('details_builder', false) || isEnabled('size_guide', false)) && hasAccess(true, 'settings:manage'),
				sections: {
					showCustomListsManager: isEnabled('details_builder', false),
					showSizeGuideTemplatesManager: isEnabled('size_guide', false)
				}
			},
			{
				tabKey: 'customer_auth',
				addonId: 'customer_auth',
				label: getLabel('customer_auth', 'customerAuthTitle', 'Autenticación & Google Sign-In'),
				icon: 'passkey',
				adminOnly: true,
				enabled: isEnabled('customer_auth', capabilities.hasCustomerAuthConfig) && hasAccess(true, 'settings:manage'),
				sections: {
					enableGoogleSignInOption: getSetting('customer_auth', 'enableGoogleSignInOption', true),
					showGoogleClientIdInput: getSetting('customer_auth', 'showGoogleClientIdInput', true),
					enableMagicCodeOption: getSetting('customer_auth', 'enableMagicCodeOption', true),
					enableEmailPasswordOption: getSetting('customer_auth', 'enableEmailPasswordOption', true),
					defaultAuthMethod: getSetting('customer_auth', 'defaultAuthMethod', 'google')
				}
			},
			{
				tabKey: 'shipping_and_delivery',
				addonId: 'local_delivery',
				label: 'Logística & Envíos',
				icon: 'local_shipping',
				adminOnly: true,
				enabled:
					(isEnabled('local_delivery', capabilities.hasLocalDeliveryAndTakeaway) ||
						isEnabled('courier_shipping', capabilities.hasAutomatedShippingCouriers)) &&
					hasAccess(true, 'settings:manage'),
				sections: {
					showZoneRatesAndFreeShipping: true,
					showExpressShipping: true
				}
			},
			{
				tabKey: 'email_studio',
				addonId: 'email_studio',
				label: getLabel('email_studio', 'emailStudioTitle', 'Emails & Plantillas (Resend)'),
				icon: 'mark_email_read',
				adminOnly: true,
				enabled: isEnabled('email_studio', capabilities.hasExternalIntegrations) && hasAccess(true, 'settings:manage'),
				sections: {
					enableResendIntegration: getSetting('email_studio', 'enableResendIntegration', true),
					enableEmailBranding: getSetting('email_studio', 'enableEmailBranding', true),
					enableOrderConfirmationEmail: getSetting('email_studio', 'enableOrderConfirmationEmail', true),
					enableBankTransferEmail: getSetting('email_studio', 'enableBankTransferEmail', true),
					enableShippingStatusEmails: getSetting('email_studio', 'enableShippingStatusEmails', true),
					enableAbandonedCartEmail: getSetting('email_studio', 'enableAbandonedCartEmail', true),
					enableBackInStockEmail: getSetting('email_studio', 'enableBackInStockEmail', true)
				}
			},
			{
				tabKey: 'marketing_pixels_and_feeds',
				addonId: 'meta_marketing',
				label: 'Meta Pixel, Feeds & GA4',
				icon: 'campaign',
				adminOnly: true,
				enabled:
					(isEnabled('meta_marketing', capabilities.hasProductFeeds) ||
						isEnabled('google_analytics', capabilities.hasExternalIntegrations)) &&
					hasAccess(true, 'settings:manage'),
				sections: {
					enableMetaPixel:
						isEnabled('meta_marketing', capabilities.hasProductFeeds) &&
						getSetting('meta_marketing', 'enableMetaPixel', true),
					enableConversionsApiCapi:
						isEnabled('meta_marketing', capabilities.hasProductFeeds) &&
						getSetting('meta_marketing', 'enableConversionsApiCapi', true),
					enableCatalogFeedUrl:
						isEnabled('meta_marketing', capabilities.hasProductFeeds) &&
						getSetting('meta_marketing', 'enableCatalogFeedUrl', true),
					enableGoogleMerchantFeedUrl:
						isEnabled('meta_marketing', capabilities.hasProductFeeds) &&
						getSetting('meta_marketing', 'enableGoogleMerchantFeedUrl', true),
					enableGa4Tracking:
						isEnabled('google_analytics', capabilities.hasExternalIntegrations) &&
						getSetting('google_analytics', 'enableGa4Tracking', true)
				}
			}
		].filter((t) => t.enabled);

		return {
			sidebarGroups,
			settingsTabs
		};
	}
}
