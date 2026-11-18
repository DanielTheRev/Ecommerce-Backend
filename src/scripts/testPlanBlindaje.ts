import { validateTenantSubscriptionIntegrity, requirePlanCapability } from '@/middleware/planGuard';
import { getPlanCapabilities, getEffectivePlanCapabilities, getEffectiveMaxEmployees, getPlanLimits, isProductTypeAllowed } from '@/config/planCapabilities';
import { validateAddonSettings, validateActiveAddonsForTenant, getSuggestedAddonsForSetup } from '@/addons/registry';
import { resolveProductFormConfig, resolveProductListViewConfig } from '@/config/formCapabilities';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { BusinessType } from '@/interfaces/tenant.interface';
import { ProductType } from '@/interfaces/product.interface';
import { AppError } from '@/errors/app.error';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
	totalTests++;
	if (condition) {
		passedTests++;
		console.log(`  ✅ [PASS] ${testName}`);
	} else {
		console.error(`  ❌ [FAIL] ${testName}`);
		throw new Error(`Test falló: ${testName}`);
	}
}

function expectError(fn: () => void, expectedCode: number, partialMessage: string, testName: string) {
	totalTests++;
	try {
		fn();
		console.error(`  ❌ [FAIL] ${testName} (No lanzó error)`);
		throw new Error(`Test falló: ${testName} - Esperaba error`);
	} catch (err: any) {
		const fullMsg = (err.message || '') + ' ' + (err.messageToSendClient || '');
		if (err instanceof AppError && err.statusCode === expectedCode && fullMsg.toLowerCase().includes(partialMessage.toLowerCase())) {
			passedTests++;
			console.log(`  ✅ [PASS] ${testName} -> [HTTP ${err.statusCode}: "${(err.messageToSendClient || err.message).substring(0, 50)}..."]`);
		} else {
			console.error(`  ❌ [FAIL] ${testName} -> Error inesperado:`, err);
			throw err;
		}
	}
}

console.log('\n🧪 ========================================================');
console.log('   SUITE DE VERIFICACIÓN DE BLINDAJE DE PLANES VEXX');
console.log('========================================================\n');

// 1. Tests de integridad de suscripción en Login / Protect
console.log('📦 1. Validación de Suscripción en Login (Fail Fast):');

expectError(
	() => validateTenantSubscriptionIntegrity(undefined),
	404,
	'No se ha podido resolver la tienda',
	'Tenant indefinido / no resuelto'
);

expectError(
	() => validateTenantSubscriptionIntegrity({ slug: 'kiosco-inactivo', isActive: false } as any),
	403,
	'se encuentra desactivada',
	'Tenant desactivado'
);

// Caso crítico: leo-mariaangelica con plan legacy 'premium' y sin planTier
expectError(
	() => validateTenantSubscriptionIntegrity({
		slug: 'leo-mariaangelica',
		name: 'Leo & María Angélica',
		isActive: true,
		plan: 'premium', // string viejo
		businessType: 'kiosk_grocery'
	} as any),
	403,
	'esquema de suscripción legacy o desactualizado',
	'Comercio Legacy (plan: "premium", sin planTier)'
);

expectError(
	() => validateTenantSubscriptionIntegrity({
		slug: 'tienda-fantasma',
		isActive: true,
		planTier: 'plan_invalido_inventado' as any,
		businessType: 'kiosk_grocery'
	} as any),
	403,
	'no es válido',
	'PlanTier con nombre no soportado'
);

expectError(
	() => validateTenantSubscriptionIntegrity({
		slug: 'tienda-sin-rubro',
		isActive: true,
		planTier: 'local',
		businessType: '' // vacío
	} as any),
	400,
	'no tiene un rubro comercial asignado',
	'Comercio sin rubro comercial (Cero fallbacks a kiosco)'
);

// Caso exitoso
assert((() => {
	validateTenantSubscriptionIntegrity({
		slug: 'comercio-al-dia',
		isActive: true,
		planTier: 'local',
		businessType: 'kiosk_grocery'
	} as any);
	return true;
})(), 'Comercio válido con planTier local y rubro');

// 2. Tests de la Matriz Oficial de Capacidades
console.log('\n📊 2. Matriz de Capacidades Oficial (Local vs Point vs Pro):');

const localCaps = getPlanCapabilities(VexxPlanTier.LOCAL);
const pointCaps = getPlanCapabilities(VexxPlanTier.POINT);
const proCaps = getPlanCapabilities(VexxPlanTier.PRO);

// Local
assert(localCaps.hasPos === true, 'Local: POS habilitado');
assert(localCaps.hasCashRegister === true, 'Local: Caja registradora habilitada');
assert(localCaps.hasArcaBilling === true, 'Local: Facturación ARCA habilitada');
assert(localCaps.hasInStorePaymentConfig === true, 'Local: Cobros QR / Point presenciales habilitados');
assert(localCaps.hasWebCatalog === false, 'Local: Catálogo web BLOQUEADO');
assert(localCaps.hasOnlineOrders === false, 'Local: Pedidos online BLOQUEADOS');
assert(localCaps.hasCoupons === true, 'Local: Cupones HABILITADOS');
assert(localCaps.hasMarketingBanners === false, 'Local: Sliders/Banners BLOQUEADOS');
assert(localCaps.hasFullWebStore === false, 'Local: Tienda web completa BLOQUEADA');
assert(localCaps.hasProductBundles === false, 'Local: Combos/Bundles BLOQUEADOS');
assert(localCaps.hasDataSets === false, 'Local: DataSets BLOQUEADOS');
assert(localCaps.hasMetricDataSets === false, 'Local: Metric DataSets BLOQUEADOS');

// Point
assert(pointCaps.hasPos === true, 'Point: POS habilitado');
assert(pointCaps.hasInStorePaymentConfig === true, 'Point: Cobros presenciales habilitados');
assert(pointCaps.hasWebCatalog === true, 'Point: Catálogo web QR habilitado');
assert(pointCaps.hasOnlineOrders === true, 'Point: Pedidos WhatsApp/Takeaway habilitados');
assert(pointCaps.hasCoupons === true, 'Point: Cupones habilitados');
assert(pointCaps.hasLocalDeliveryAndTakeaway === true, 'Point: Delivery local propio habilitado');
assert(pointCaps.hasMarketingBanners === false, 'Point: Sliders web pesados BLOQUEADOS');
assert(pointCaps.hasFullWebStore === false, 'Point: Tienda web completa BLOQUEADA');
assert(pointCaps.hasProductBundles === true, 'Point: Combos/Bundles HABILITADOS');
assert(pointCaps.hasDataSets === true, 'Point: DataSets HABILITADOS (Filtros de Catálogo)');
assert(pointCaps.hasMetricDataSets === false, 'Point: Metric DataSets BLOQUEADOS (Up-sell Pro)');

// Pro
assert(proCaps.hasPos === true, 'Pro: POS habilitado');
assert(proCaps.hasWebCatalog === true, 'Pro: Catálogo web habilitado');
assert(proCaps.hasCoupons === true, 'Pro: Cupones habilitados');
assert(proCaps.hasMarketingBanners === true, 'Pro: Sliders y Menú Bento habilitados');
assert(proCaps.hasFullWebStore === true, 'Pro: Tienda web completa habilitada');
assert(proCaps.hasProductFeeds === true, 'Pro: Feeds Google/Meta habilitados');
assert(proCaps.hasProductBundles === true, 'Pro: Combos/Bundles HABILITADOS');
assert(proCaps.hasDataSets === true, 'Pro: DataSets HABILITADOS');
assert(proCaps.hasMetricDataSets === true, 'Pro: Metric DataSets HABILITADOS (Tiempo Real)');

// 3. Tests de Middleware requirePlanCapability
console.log('\n🛡️ 3. Guardián de Rutas en Backend (requirePlanCapability):');

const mockRes: any = {};
const nextCalled = (middleware: Function, req: any) => {
	let called = false;
	middleware(req, mockRes, (err: any) => {
		if (err) throw err;
		called = true;
	});
	return called;
};

// Intento de llamar a Hero Sliders con plan Local
expectError(
	() => nextCalled(
		requirePlanCapability('hasMarketingBanners', 'Hero Sliders'),
		{ tenant: { slug: 'almacen-pepe', isActive: true, planTier: 'local', businessType: 'kiosk_grocery' } }
	),
	403,
	'no incluye la función \'Hero Sliders\'',
	'Bloqueo de Hero Sliders para Plan Local'
);

// Intento de llamar a Pedidos Online con plan Local (Bloqueado)
expectError(
	() => nextCalled(
		requirePlanCapability('hasOnlineOrders', 'Pedidos Online'),
		{ tenant: { slug: 'almacen-pepe', isActive: true, planTier: 'local', businessType: 'kiosk_grocery' } }
	),
	403,
	'no incluye la función \'Pedidos Online\'',
	'Bloqueo de Pedidos Online para Plan Local'
);

// Llamar a Cupones con plan Local -> Permitido
assert(
	nextCalled(
		requirePlanCapability('hasCoupons', 'Cupones de Descuento'),
		{ tenant: { slug: 'almacen-pepe', isActive: true, planTier: 'local', businessType: 'kiosk_grocery' } }
	),
	'Permitir Cupones para Plan Local'
);

// Llamar a Cupones con plan Point -> Permitido
assert(
	nextCalled(
		requirePlanCapability('hasCoupons', 'Cupones de Descuento'),
		{ tenant: { slug: 'rotiseria-point', isActive: true, planTier: 'point', businessType: BusinessType.GASTRONOMY } }
	),
	'Permitir Cupones para Plan Point'
);

// Intento de llamar a Combos con plan Local -> Bloqueado
expectError(
	() => nextCalled(
		requirePlanCapability('hasProductBundles', 'Conjuntos de Productos / Combos'),
		{ tenant: { slug: 'kiosco-local', isActive: true, planTier: 'local', businessType: BusinessType.KIOSK_GROCERY } }
	),
	403,
	'no incluye la función \'Conjuntos de Productos / Combos\'',
	'Bloqueo de Combos para Plan Local'
);

// Combos en Plan Point para Carnicería -> PERMITIDO (Universal)
assert(
	nextCalled(
		requirePlanCapability('hasProductBundles', 'Conjuntos de Productos / Combos'),
		{ tenant: { slug: 'carniceria-point', isActive: true, planTier: 'point', businessType: BusinessType.BUTCHER } }
	),
	'Permitir Combos para Carnicería en Plan Point (Combo Asado)'
);

// Combos en Plan Point para Panadería -> PERMITIDO
assert(
	nextCalled(
		requirePlanCapability('hasProductBundles', 'Conjuntos de Productos / Combos'),
		{ tenant: { slug: 'panaderia-point', isActive: true, planTier: 'point', businessType: BusinessType.BAKERY } }
	),
	'Permitir Combos para Panadería en Plan Point (Meriendas)'
);

// Combos en Plan Pro para Boutique Moda -> PERMITIDO
assert(
	nextCalled(
		requirePlanCapability('hasProductBundles', 'Conjuntos de Productos / Combos'),
		{ tenant: { slug: 'boutique-pro', isActive: true, planTier: 'pro', businessType: BusinessType.FASHION } }
	),
	'Permitir Combos para Boutique Moda en Plan Pro'
);

// DataSets con Métricas en Point -> BLOQUEADO (Up-sell Pro)
expectError(
	() => nextCalled(
		requirePlanCapability('hasMetricDataSets', 'Conjuntos con Métricas'),
		{ tenant: { slug: 'tienda-point', isActive: true, planTier: 'point', businessType: BusinessType.FASHION } }
	),
	403,
	'no incluye la función \'Conjuntos con Métricas\'',
	'Bloqueo de DataSets con Métricas en Plan Point (Up-sell)'
);

// DataSets con Métricas en Pro -> PERMITIDO
assert(
	nextCalled(
		requirePlanCapability('hasMetricDataSets', 'Conjuntos con Métricas'),
		{ tenant: { slug: 'tienda-pro', isActive: true, planTier: 'pro', businessType: BusinessType.FASHION } }
	),
	'Permitir DataSets con Métricas en Plan Pro'
);

// 4. Tests de Capacidades Efectivas (Intersección Plan x Rubro)
console.log('\n🧩 4. Capacidades Efectivas (Intersección Plan x Rubro):');
const butcherPro = getEffectivePlanCapabilities(VexxPlanTier.PRO, BusinessType.BUTCHER);
assert(butcherPro.hasProductBundles === true, 'Carnicería Pro: Combos Habilitados');
assert(butcherPro.hasScaleWeightPricing === true, 'Carnicería Pro: Balanza por peso activada');
assert(butcherPro.hasFullWebStore === true, 'Carnicería Pro: Tienda web activa');

const fashionPro = getEffectivePlanCapabilities(VexxPlanTier.PRO, BusinessType.FASHION);
assert(fashionPro.hasProductBundles === true, 'Moda Pro: Combos Habilitados');
assert(fashionPro.hasScaleWeightPricing === false, 'Moda Pro: Balanza por peso desactivada');

const fashionLocal = getEffectivePlanCapabilities(VexxPlanTier.LOCAL, BusinessType.FASHION);
assert(fashionLocal.hasProductBundles === false, 'Moda Local: Combos desactivados (Plan Local)');
assert(fashionLocal.hasScaleWeightPricing === false, 'Moda Local: Balanza desactivada (Rubro)');
assert(fashionLocal.hasPos === true, 'Moda Local: POS activado');

// Validación de Tipos de Producto Unificados
assert(isProductTypeAllowed(BusinessType.FASHION, ProductType.CLOTHING) === true, 'Moda permite ClothingProduct');
assert(isProductTypeAllowed(BusinessType.FASHION, ProductType.KIOSK) === true, 'Moda permite KioskProduct (Modelo Unificado)');
assert(isProductTypeAllowed(BusinessType.KIOSK_GROCERY, ProductType.KIOSK) === true, 'Kiosco permite KioskProduct');

// 4b. Mando del SuperAdmin (activeAddons manda 100% sobre el preset del Plan)
console.log('\n🧩 4b. Mando del SuperAdmin (Tienda 100% Online sin POS ni Caja):');
const onlineOnlyLocal = getEffectivePlanCapabilities(VexxPlanTier.LOCAL, BusinessType.FASHION, [
	'store_management',
	'web_catalog',
	'combos',
	'coupons'
]);
assert(onlineOnlyLocal.hasPos === false, 'Tienda 100% Online: POS desactivado aunque sea Plan Local');
assert(onlineOnlyLocal.hasCashRegister === false, 'Tienda 100% Online: Caja desactivada aunque sea Plan Local');
assert(onlineOnlyLocal.hasWebCatalog === true, 'Tienda 100% Online: Catálogo Web activado por SuperAdmin');
assert(onlineOnlyLocal.hasProductBundles === true, 'Tienda 100% Online: Combos activado por alias "combos"');
assert(onlineOnlyLocal.hasCoupons === true, 'Tienda 100% Online: Cupones activado por SuperAdmin');

// 5. Tests de Límites de Empleados (Base 10 + Extras)
console.log('\n👥 5. Límites de Empleados Efectivos:');
assert(getEffectiveMaxEmployees('local', 0) === 10, 'Local sin extras: 10 empleados');
assert(getEffectiveMaxEmployees('local', 5) === 15, 'Local con 5 extras comprados: 15 empleados');
assert(getEffectiveMaxEmployees('point', 0) === 10, 'Point sin extras: 10 empleados');
assert(getEffectiveMaxEmployees('pro', 0) === 25, 'Pro sin extras: 25 empleados');
assert(getEffectiveMaxEmployees('pro', 10) === 35, 'Pro con 10 extras: 35 empleados');

// 6. Blindaje de Inmutabilidad (Object.freeze en Singletons)
console.log('\n🧊 6. Inmutabilidad y Encapsulamiento de Singletons:');
assert(Object.isFrozen(getPlanCapabilities('local')), 'Singleton Local está congelado (Object.isFrozen)');
assert(Object.isFrozen(getPlanCapabilities('point')), 'Singleton Point está congelado (Object.isFrozen)');
assert(Object.isFrozen(getPlanCapabilities('pro')), 'Singleton Pro está congelado (Object.isFrozen)');
assert(Object.isFrozen(getPlanLimits('local')), 'Límites de Local están congelados');
assert(getPlanLimits('point').baseEmployees === 10, 'Point hereda 10 empleados de Local');
assert(getPlanLimits('pro').baseEmployees === 25, 'Pro sobrescribe a 25 empleados');

let mutationThrew = false;
try {
	(getPlanCapabilities('local') as any).hasFullWebStore = true;
} catch {
	mutationThrew = true;
}
assert(mutationThrew || getPlanCapabilities('local').hasFullWebStore === false, 'Intento de mutación es rechazado (inmutable)');

// 7. Armonía de Formularios y Vistas Dinámicas (formCapabilities.ts)
console.log('\n📝 7. Armonía de Formularios y Vistas Dinámicas (formCapabilities.ts):');

const localKioskForm = resolveProductFormConfig(BusinessType.KIOSK_GROCERY, VexxPlanTier.LOCAL);
assert(localKioskForm.maxImagesAllowed === 20, 'Local Kiosco: límite de 20 imágenes');
assert(localKioskForm.showMultiPhotosGallery === true, 'Local Kiosco: galería visible para POS táctil');
assert(localKioskForm.showWeightScalePrice === true, 'Local Kiosco: balanza $/Kg habilitada');
assert(localKioskForm.showVariantsGrid === false, 'Local Kiosco: sin grilla de talles');
assert(localKioskForm.showSpecifications === true, 'Local Kiosco: especificaciones clave-valor universales');

const pointButcherForm = resolveProductFormConfig(BusinessType.BUTCHER, VexxPlanTier.POINT);
assert(pointButcherForm.maxImagesAllowed === 50, 'Point Carnicería: límite de 50 imágenes');
assert(pointButcherForm.showProductBundleOptions === true, 'Point Carnicería: combos de productos habilitados');
assert(pointButcherForm.bundleLabel === 'Combos Parrilleros & Packs', 'Point Carnicería: etiqueta "Combos Parrilleros & Packs"');
assert(pointButcherForm.allowVariantImageLinking === true, 'Point Carnicería: 1 a N de fotos por variante');

const pointTechForm = resolveProductFormConfig(BusinessType.TECH_ELECTRONICS, VexxPlanTier.POINT);
assert(pointTechForm.showVariantsGrid === true, 'Point Tech: variantes de almacenamiento/color habilitadas');
assert(pointTechForm.showSpecifications === true, 'Point Tech: especificaciones universales habilitadas');
assert(pointTechForm.bundleLabel === 'Kits & Combos Tech', 'Point Tech: etiqueta "Kits & Combos Tech"');

const proFashionForm = resolveProductFormConfig(BusinessType.FASHION, VexxPlanTier.PRO);
assert(proFashionForm.maxImagesAllowed === 100, 'Pro Moda: límite de 100 imágenes');
assert(proFashionForm.allowedAspectRatios.length === 4, 'Pro Moda: relaciones de aspecto duales (1:1, 9:16, etc.)');
assert(proFashionForm.showVariantsGrid === true, 'Pro Moda: curva de talles y colores');
assert(proFashionForm.bundleLabel === 'Shop The Look / Outfits', 'Pro Moda: etiqueta "Shop The Look / Outfits"');
assert(proFashionForm.showSeoFields === true, 'Pro Moda: campos SEO habilitados');

// Vistas de Listado (ProductListViewConfig)
const pointListView = resolveProductListViewConfig(BusinessType.FASHION, VexxPlanTier.POINT);
assert(pointListView.showDataSetsTab === true, 'Point: pestaña Conjuntos de Datos visible');
assert(pointListView.showProductBundlesTab === true, 'Point: pestaña Conjuntos de Productos visible');
assert(pointListView.allowMetricFiltersInDataSets === false, 'Point: filtros de métricas bloqueados (Up-sell Pro)');

const proListView = resolveProductListViewConfig(BusinessType.FASHION, VexxPlanTier.PRO);
assert(proListView.showDataSetsTab === true, 'Pro: pestaña Conjuntos de Datos visible');
assert(proListView.showProductBundlesTab === true, 'Pro: pestaña Conjuntos de Productos visible');
assert(proListView.allowMetricFiltersInDataSets === true, 'Pro: filtros de métricas en tiempo real HABILITADOS');

// 8. Validación Zod de Addons (Frena guardado inválido antes de tocar DB)
console.log('\n🔌 8. Validación Zod de Complementos (src/addons/):');
expectError(
	() => validateAddonSettings('arca_invoicing', { cuit: '123', ptoVta: 1 }),
	400,
	'11 dígitos',
	'ARCA rechaza CUIT inválido'
);
const validArca = validateAddonSettings('arca_invoicing', { cuit: '20301234567', ptoVta: 2 });
assert(validArca.cuit === '20301234567' && validArca.ptoVta === 2, 'ARCA acepta configuración válida');

const fashionSinTechSpecs = resolveProductFormConfig(BusinessType.FASHION, VexxPlanTier.POINT, false, ['variants']);
assert(fashionSinTechSpecs.showVariantsGrid === true, 'Moda con addon variants: grilla de talles activa');
assert(fashionSinTechSpecs.showSpecifications === false, 'Moda sin addon tech_specs: ficha técnica oculta');

const fashionConTechSpecs = resolveProductFormConfig(BusinessType.FASHION, VexxPlanTier.POINT, false, ['variants', 'tech_specs']);
assert(fashionConTechSpecs.showSpecifications === true, 'Moda con addon tech_specs: ficha técnica visible');

// 9. Simulación de Alta de Comercio desde SuperAdmin (Presets + Blindaje Draft)
console.log('\n🚀 9. Flujo de Alta de Comercio (Onboarding SuperAdmin):');
const butcherLocalPreset = getSuggestedAddonsForSetup(VexxPlanTier.LOCAL, BusinessType.BUTCHER);
assert(butcherLocalPreset.includes('pos') && butcherLocalPreset.includes('weighable'), 'Preset Carnicería Local sugiere pos y weighable');
assert(!butcherLocalPreset.includes('thermal_tickets') && !butcherLocalPreset.includes('expirations'), 'Preset excluye módulos en estado borrador (draft)');

expectError(
	() => validateActiveAddonsForTenant(['pos', 'thermal_tickets']),
	400,
	'borrador',
	'Alta rechaza activar complemento en estado borrador (thermal_tickets)'
);
expectError(
	() => validateActiveAddonsForTenant(['addon_fantasma']),
	400,
	'no existe',
	'Alta rechaza ID de complemento inexistente'
);
const customOnlineStoreAddons = validateActiveAddonsForTenant(['store_management', 'web_catalog', 'combos', 'coupons']);
assert(
	customOnlineStoreAddons.includes('product_bundles') && !customOnlineStoreAddons.includes('pos'),
	'Alta custom normaliza alias ("combos" -> "product_bundles") y respeta ausencia de POS'
);

console.log('\n════════════════════════════════════════════════════════');
console.log(`✨ RESULTADOS: ${passedTests} de ${totalTests} tests pasaron exitosamente (100%).`);
console.log('════════════════════════════════════════════════════════\n');
