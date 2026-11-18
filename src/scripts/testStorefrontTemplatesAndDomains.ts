import assert from 'assert';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { BusinessType, ITenant, TenantPlan } from '@/interfaces/tenant.interface';
import {
	DEFAULT_STOREFRONT_TEMPLATES,
	StorefrontTemplateService,
	SuperAdminUpdateTenantStorefrontZodSchema,
	UpsertStorefrontTemplateZodSchema
} from '@/services/storefrontTemplate.service';
import {
	buildCapabilitiesFromAddons,
	getAddonModule,
	getPublicAddonCatalog,
	validateAddonSettings
} from '@/addons/registry';

async function runTests() {
	console.log('🧪 Iniciando pruebas de Storefront Templates & Resolución de Dominios...\n');

	// 1. Verificar registro del Addon storefront_templates
	const addonMod = getAddonModule('storefront_templates');
	assert(addonMod, 'El addon storefront_templates debe estar registrado en registry.ts');
	assert.strictEqual(addonMod.manifest.id, 'storefront_templates');
	assert(addonMod.manifest.includedInPlans.includes(VexxPlanTier.POINT));
	assert(addonMod.manifest.includedInPlans.includes(VexxPlanTier.PRO));
	assert(addonMod.manifest.grantsCapabilities.includes('hasThemeTemplates'));

	const aliasMod = getAddonModule('theme_templates');
	assert(aliasMod && aliasMod.manifest.id === 'storefront_templates', 'El alias theme_templates debe resolver a storefront_templates');

	const catalog = getPublicAddonCatalog();
	assert(catalog.some((a) => a.id === 'storefront_templates'), 'El catálogo público debe incluir storefront_templates');
	console.log('✅ 1. Addon storefront_templates registrado correctamente en catálogo oficial.');

	// 2. Validar esquemas Zod de CRUD de plantillas (SuperAdmin console.vexx)
	for (const tpl of DEFAULT_STOREFRONT_TEMPLATES) {
		const parsed = UpsertStorefrontTemplateZodSchema.parse(tpl);
		assert.strictEqual(parsed.key, tpl.key);
	}

	const customMonthlyTpl = UpsertStorefrontTemplateZodSchema.parse({
		key: 'electro_pro_store',
		name: 'Electro & Tech Store',
		shortDescription: 'Tienda especializada en tecnología y electrónica con comparador de fichas técnicas.',
		engine: 'astro',
		checkoutMode: 'full_ecommerce',
		minPlanTier: VexxPlanTier.PRO,
		supportedBusinessTypes: ['tech_electronics'],
		pricingType: 'monthly_addon',
		priceARS: 28000,
		monthlyPriceARS: 28000,
		features: ['Comparador de specs', 'Filtros por marca y capacidad'],
		customizableFields: [
			{
				key: 'accentColor',
				label: 'Color de acento',
				type: 'color',
				defaultValue: '#0284C7'
			}
		],
		isActive: true
	});
	assert.strictEqual(customMonthlyTpl.pricingType, 'monthly_addon');
	assert.strictEqual(customMonthlyTpl.monthlyPriceARS, 28000);
	console.log('✅ 2. Esquema CRUD de plantillas (included_in_plan, monthly_addon, one_time_purchase, custom_quote) validado.');

	// 3. Verificar desbloqueo por plan y por asignación de SuperAdmin (unlockedTemplates)
	const pointCatalogTpl = DEFAULT_STOREFRONT_TEMPLATES.find((t) => t.key === 'point_mobile_catalog')!;
	const vuraEditorialTpl = DEFAULT_STOREFRONT_TEMPLATES.find((t) => t.key === 'vura_editorial')!;
	const vuraAngularTpl = DEFAULT_STOREFRONT_TEMPLATES.find((t) => t.key === 'vura_angular_flagship')!;

	const pointTenant: ITenant = {
		_id: 'tenant_point_1',
		slug: 'lo-de-tito',
		name: 'Lo de Tito',
		dbName: 'lo_de_tito_db',
		businessType: BusinessType.KIOSK_GROCERY,
		plan: TenantPlan.basic,
		planTier: VexxPlanTier.POINT,
		activeAddons: ['web_catalog', 'storefront_templates'],
		unlockedTemplates: [],
		isActive: true,
		settings: { allowedOrigins: [] },
		createdAt: new Date(),
		updatedAt: new Date()
	};

	assert.strictEqual(
		StorefrontTemplateService.isTemplateUnlockedForTenant(pointCatalogTpl, pointTenant),
		true,
		'Un comercio POINT debe tener desbloqueada la plantilla gratuita point_mobile_catalog'
	);
	assert.strictEqual(
		StorefrontTemplateService.isTemplateUnlockedForTenant(vuraEditorialTpl, pointTenant),
		false,
		'Un comercio POINT NO debe tener desbloqueada una plantilla PRO por defecto'
	);
	assert.strictEqual(
		StorefrontTemplateService.isTemplateUnlockedForTenant(vuraAngularTpl, pointTenant),
		false,
		'Una plantilla monthly_addon NO debe estar desbloqueada sin asignación en unlockedTemplates'
	);

	// Si desde console.vexx se la desbloqueamos en unlockedTemplates:
	const pointTenantWithUnlocked: ITenant = {
		...pointTenant,
		unlockedTemplates: ['vura_angular_flagship']
	};
	assert.strictEqual(
		StorefrontTemplateService.isTemplateUnlockedForTenant(vuraAngularTpl, pointTenantWithUnlocked),
		true,
		'Una plantilla agregada en unlockedTemplates desde console.vexx debe quedar desbloqueada para el comercio'
	);
	console.log('✅ 3. Reglas de desbloqueo por Plan (POINT/PRO) y por SuperAdmin (unlockedTemplates) verificadas.');

	// 4. Verificar buildTenantStorefrontSummary (Subdominio Vexx vs Dominio Propio)
	const pointSummary = await StorefrontTemplateService.buildTenantStorefrontSummary(
		pointTenant,
		DEFAULT_STOREFRONT_TEMPLATES
	);
	assert.strictEqual(pointSummary.domainMode, 'vexx_subdomain');
	assert.strictEqual(pointSummary.vexxSubdomain, 'lo-de-tito.vexx.com.ar');
	assert.strictEqual(pointSummary.vexxSubdomainUrl, 'https://lo-de-tito.vexx.com.ar');
	assert.strictEqual(pointSummary.primaryStorefrontUrl, 'https://lo-de-tito.vexx.com.ar');
	assert.strictEqual(pointSummary.hasCustomDomainCapability, false);
	assert.strictEqual(pointSummary.activeTemplateKey, 'point_mobile_catalog');
	assert.strictEqual(pointSummary.activeTemplateEngine, 'astro');

	const proFashionTenant: ITenant = {
		_id: 'tenant_pro_vura',
		slug: 'vura',
		name: 'Vura Clothing',
		dbName: 'vura_store_db',
		businessType: BusinessType.FASHION,
		domain: 'vura.com.ar',
		domainMode: 'custom_domain',
		activeTemplateKey: 'vura_angular_flagship',
		unlockedTemplates: ['vura_angular_flagship', 'vura_editorial'],
		templateSettings: {
			announcementBarText: '6 cuotas sin interés en toda la colección'
		},
		plan: TenantPlan.premium,
		planTier: VexxPlanTier.PRO,
		activeAddons: ['ecommerce_web', 'storefront_templates', 'custom_domain'],
		isActive: true,
		settings: { allowedOrigins: [] },
		createdAt: new Date(),
		updatedAt: new Date()
	};

	const proSummary = await StorefrontTemplateService.buildTenantStorefrontSummary(
		proFashionTenant,
		DEFAULT_STOREFRONT_TEMPLATES
	);
	assert.strictEqual(proSummary.domainMode, 'custom_domain');
	assert.strictEqual(proSummary.vexxSubdomain, 'vura.vexx.com.ar');
	assert.strictEqual(proSummary.customDomain, 'vura.com.ar');
	assert.strictEqual(proSummary.customDomainUrl, 'https://vura.com.ar');
	assert.strictEqual(proSummary.primaryStorefrontUrl, 'https://vura.com.ar');
	assert.strictEqual(proSummary.hasCustomDomainCapability, true);
	assert.strictEqual(proSummary.activeTemplateKey, 'vura_angular_flagship');
	assert.strictEqual(proSummary.activeTemplateEngine, 'angular');
	assert.strictEqual(proSummary.templateSettings.announcementBarText, '6 cuotas sin interés en toda la colección');
	assert.strictEqual(proSummary.templateSettings.enableQuickAdd, true); // default hidratado
	console.log('✅ 4. Resumen de Storefront (subdominio gratuito *.vexx.com.ar vs dominio propio + settings) verificado.');

	// 5. Validar normalización y blindaje de dominios propios
	assert.strictEqual(
		StorefrontTemplateService.normalizeCustomDomain('https://www.MiTienda.com.ar/catalogo'),
		'mitienda.com.ar'
	);
	assert.throws(
		() => StorefrontTemplateService.normalizeCustomDomain('mi-tienda.vexx.com.ar'),
		(err: any) => err?.message === 'Reserved platform domain' && /subdominio/i.test(err?.messageToSendClient || ''),
		'Debe rechazar un subdominio de vexx.com.ar como customDomain propio'
	);
	assert.throws(
		() => StorefrontTemplateService.normalizeCustomDomain('dominio invalido sin tld'),
		(err: any) => err?.message === 'Invalid domain format' && /formato válido/i.test(err?.messageToSendClient || ''),
		'Debe rechazar dominios con formato inválido'
	);

	const superAdminPatch = SuperAdminUpdateTenantStorefrontZodSchema.parse({
		activeTemplateKey: 'vura_editorial',
		unlockedTemplates: ['vura_editorial', 'vura_angular_flagship'],
		domainMode: 'custom_domain',
		customDomain: 'vuraclothing.com.ar'
	});
	assert.strictEqual(superAdminPatch.domainMode, 'custom_domain');
	console.log('✅ 5. Normalización de dominios y validaciones SuperAdmin verificadas.');

	// 6. Verificar todos los nuevos Addons de Operaciones, Web/Marketing y Configuración
	const expectedAddonIds = [
		'store_identity',
		'sales_control',
		'daily_summary',
		'fiscal_audit',
		'online_orders',
		'pos',
		'cash_register',
		'customer_accounts',
		'category_manager',
		'suppliers',
		'home_layout',
		'marketing_banners',
		'coupons',
		'newsletter',
		'email_studio',
		'meta_marketing',
		'google_analytics',
		'storefront_connection',
		'customer_auth',
		'storefront_templates'
	];

	for (const id of expectedAddonIds) {
		const mod = getAddonModule(id);
		assert(mod, `El addon '${id}' debe existir en registry.ts`);
		assert.strictEqual(mod.manifest.id, id);
		assert(
			Array.isArray(mod.manifest.configurableSettings) && mod.manifest.configurableSettings.length > 0,
			`El addon '${id}' debe exponer configurableSettings`
		);
	}

	// Validar alias y settings Zod de los nuevos addons
	assert.strictEqual(getAddonModule('sales_history')?.manifest.id, 'sales_control');
	assert.strictEqual(getAddonModule('headless_api')?.manifest.id, 'storefront_connection');
	assert.strictEqual(getAddonModule('auth_config')?.manifest.id, 'customer_auth');
	assert.strictEqual(getAddonModule('resend_emails')?.manifest.id, 'email_studio');
	assert.strictEqual(getAddonModule('meta_pixel')?.manifest.id, 'meta_marketing');
	assert.strictEqual(getAddonModule('product_feeds')?.manifest.id, 'meta_marketing');
	assert.strictEqual(getAddonModule('ga4')?.manifest.id, 'google_analytics');
	assert.strictEqual(getAddonModule('home_builder')?.manifest.id, 'home_layout');
	assert.strictEqual(getAddonModule('daily_stats')?.manifest.id, 'daily_summary');
	assert.strictEqual(getAddonModule('monotributo_audit')?.manifest.id, 'fiscal_audit');

	const parsedAuthSettings = validateAddonSettings('customer_auth', {
		enableGoogleSignInOption: true,
		enableMagicCodeOption: true,
		enableEmailPasswordOption: false,
		defaultAuthMethod: 'magic_code'
	});
	assert.strictEqual(parsedAuthSettings.defaultAuthMethod, 'magic_code');
	assert.strictEqual(parsedAuthSettings.enableEmailPasswordOption, false);

	const parsedConnectionSettings = validateAddonSettings('storefront_connection', {
		allowMerchantRegenerateApiKey: false,
		allowMerchantEditAllowedOrigins: true,
		maxAllowedOrigins: 5
	});
	assert.strictEqual(parsedConnectionSettings.allowMerchantRegenerateApiKey, false);
	assert.strictEqual(parsedConnectionSettings.maxAllowedOrigins, 5);

	const builtCaps = buildCapabilitiesFromAddons(expectedAddonIds);
	assert.strictEqual(builtCaps.hasSalesHistory, true);
	assert.strictEqual(builtCaps.hasDailySummary, true);
	assert.strictEqual(builtCaps.hasFiscalAudit, true);
	assert.strictEqual(builtCaps.hasOnlineOrders, true);
	assert.strictEqual(builtCaps.hasCategoryManager, true);
	assert.strictEqual(builtCaps.hasHomeLayoutBuilder, true);
	assert.strictEqual(builtCaps.hasStoreIdentity, true);
	assert.strictEqual(builtCaps.hasHeadlessApiKey, true);
	assert.strictEqual(builtCaps.hasCustomerAuthConfig, true);
	assert.strictEqual(builtCaps.hasExternalIntegrations, true);
	assert.strictEqual(builtCaps.hasNewsletter, true);

	console.log('✅ 6. Catálogo completo de Addons (Operaciones, Home/Marketing y Configuración/Auth/API Key/Integraciones) verificado.\n');

	console.log('🎉 TODAS LAS PRUEBAS DE PLANTILLAS, DOMINIOS Y ADDONS PASARON EXITOSAMENTE.');
}

runTests().catch((err) => {
	console.error('❌ Falló la suite de pruebas:', err);
	process.exit(1);
});
