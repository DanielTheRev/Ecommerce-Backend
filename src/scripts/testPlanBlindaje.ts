import { validateTenantSubscriptionIntegrity, requirePlanCapability } from '@/middleware/planGuard';
import { getPlanCapabilities, getEffectivePlanCapabilities, getEffectiveMaxEmployees, getPlanLimits, isProductTypeAllowed } from '@/config/planCapabilities';
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
assert(localCaps.hasShopTheLook === false, 'Local: ShopTheLook BLOQUEADO');
assert(localCaps.hasFullWebStore === false, 'Local: Tienda web completa BLOQUEADA');

// Point
assert(pointCaps.hasPos === true, 'Point: POS habilitado');
assert(pointCaps.hasInStorePaymentConfig === true, 'Point: Cobros presenciales habilitados');
assert(pointCaps.hasWebCatalog === true, 'Point: Catálogo web QR habilitado');
assert(pointCaps.hasOnlineOrders === true, 'Point: Pedidos WhatsApp/Takeaway habilitados');
assert(pointCaps.hasCoupons === true, 'Point: Cupones habilitados');
assert(pointCaps.hasLocalDeliveryAndTakeaway === true, 'Point: Delivery local propio habilitado');
assert(pointCaps.hasMarketingBanners === false, 'Point: Sliders web pesados BLOQUEADOS');
assert(pointCaps.hasShopTheLook === false, 'Point: ShopTheLook BLOQUEADO');
assert(pointCaps.hasFullWebStore === false, 'Point: Tienda web completa BLOQUEADA');

// Pro
assert(proCaps.hasPos === true, 'Pro: POS habilitado');
assert(proCaps.hasWebCatalog === true, 'Pro: Catálogo web habilitado');
assert(proCaps.hasCoupons === true, 'Pro: Cupones habilitados');
assert(proCaps.hasMarketingBanners === true, 'Pro: Sliders y Menú Bento habilitados');
assert(proCaps.hasShopTheLook === true, 'Pro: ShopTheLook habilitado');
assert(proCaps.hasFullWebStore === true, 'Pro: Tienda web completa habilitada');
assert(proCaps.hasProductFeeds === true, 'Pro: Feeds Google/Meta habilitados');

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

// Intento de llamar a Shop The Look con plan Point -> Bloqueado
expectError(
	() => nextCalled(
		requirePlanCapability('hasShopTheLook', 'Shop The Look'),
		{ tenant: { slug: 'rotiseria-point', isActive: true, planTier: 'point', businessType: BusinessType.GASTRONOMY } }
	),
	403,
	'no incluye la función \'Shop The Look\'',
	'Bloqueo de Shop The Look para Plan Point'
);

// Caso crítico del usuario: Carnicería con Plan Pro intenta usar Shop The Look -> BLOQUEADO POR RUBRO
expectError(
	() => nextCalled(
		requirePlanCapability('hasShopTheLook', 'Shop The Look'),
		{ tenant: { slug: 'carniceria-pro', isActive: true, planTier: 'pro', businessType: BusinessType.BUTCHER } }
	),
	403,
	'no incluye la función \'Shop The Look\'',
	'Bloqueo de Shop The Look para Carnicería en Plan Pro'
);

// Llamar a Shop The Look con plan Pro y Rubro Moda -> PERMITIDO
assert(
	nextCalled(
		requirePlanCapability('hasShopTheLook', 'Shop The Look'),
		{ tenant: { slug: 'boutique-pro', isActive: true, planTier: 'pro', businessType: BusinessType.FASHION } }
	),
	'Permitir Shop The Look para Boutique Moda en Plan Pro'
);

// 4. Tests de Capacidades Efectivas (Intersección Plan x Rubro)
console.log('\n🧩 4. Capacidades Efectivas (Intersección Plan x Rubro):');
const butcherPro = getEffectivePlanCapabilities(VexxPlanTier.PRO, BusinessType.BUTCHER);
assert(butcherPro.hasShopTheLook === false, 'Carnicería Pro: Shop The Look desactivado');
assert(butcherPro.hasScaleWeightPricing === true, 'Carnicería Pro: Balanza por peso activada');
assert(butcherPro.hasFullWebStore === true, 'Carnicería Pro: Tienda web activa');

const fashionPro = getEffectivePlanCapabilities(VexxPlanTier.PRO, BusinessType.FASHION);
assert(fashionPro.hasShopTheLook === true, 'Moda Pro: Shop The Look activado');
assert(fashionPro.hasScaleWeightPricing === false, 'Moda Pro: Balanza por peso desactivada');

const fashionLocal = getEffectivePlanCapabilities(VexxPlanTier.LOCAL, BusinessType.FASHION);
assert(fashionLocal.hasShopTheLook === false, 'Moda Local: Shop The Look desactivado (Plan)');
assert(fashionLocal.hasScaleWeightPricing === false, 'Moda Local: Balanza desactivada (Rubro)');
assert(fashionLocal.hasPos === true, 'Moda Local: POS activado');

// Validación de Tipos de Producto Mongoose
assert(isProductTypeAllowed(BusinessType.FASHION, ProductType.CLOTHING) === true, 'Moda permite ClothingProduct');
assert(isProductTypeAllowed(BusinessType.FASHION, ProductType.KIOSK) === false, 'Moda rechaza KioskProduct');
assert(isProductTypeAllowed(BusinessType.KIOSK_GROCERY, ProductType.KIOSK) === true, 'Kiosco permite KioskProduct');

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

console.log('\n════════════════════════════════════════════════════════');
console.log(`✨ RESULTADOS: ${passedTests} de ${totalTests} tests pasaron exitosamente (100%).`);
console.log('════════════════════════════════════════════════════════\n');
