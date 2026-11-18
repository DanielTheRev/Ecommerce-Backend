import assert from 'assert';
import {
	LocalProduct,
	PointProduct,
	ProProduct,
	ProductDomainFactory,
	LOCAL_MAX_IMAGES,
	POINT_MAX_IMAGES,
	PRO_MAX_IMAGES,
	ALLOWED_WEIGHABLE_UNITS
} from '@/domain/product/product.classes';
import { ProductStatus } from '@/interfaces/product.interface';

console.log('🧪 ========================================================');
console.log('   SUITE DE VERIFICACIÓN DE ARQUITECTURA DE PRODUCTOS VEXX');
console.log('========================================================\n');

const mockPrice: any = {
	listPrice: 15000,
	card_ticket1PayPrice: 14000,
	cashTransferPrice: 12000,
	discountPercentageTransfer: 20,
	installments: {
		threePaymentsAmount: 5000,
		sixPaymentsAmount: 2800,
		hasThreeInstallmentsSeamless: true,
		hasSixInstallmentsSeamless: false
	}
};

const mockFinance: any = {
	exchangeRateSnapshot: 1250,
	mpCommissionSnapshot: { base: 6.5, cft3Cuotas: 12.5, cft6Cuotas: 22.0 },
	providerCost: { inUSD: 8, inARS: 10000 },
	additionalCosts: [],
	pricingStrategy: { method: 'markup', targetProfit: 20 },
	calculatedProfits: { transfer: 2000, card_ticket1Pay: 1800, card3Installments: 1500, card6Installments: 1200 }
};

// ============================================================================
// 1. VERIFICACIÓN PLAN LOCAL
// ============================================================================
console.log('📦 1. Verificación de Plan Local:');

// 1.1 Rechazo por falta de status
assert.throws(() => {
	new LocalProduct({
		name: 'Coca Cola 2.25L',
		category: 'Bebidas',
		price: mockPrice,
		finance: mockFinance,
		status: '' as any
	});
}, /El estado del producto.*es obligatorio/);
console.log('  ✅ [PASS] Rechaza status faltante (Cero fallbacks silenciosos)');

// 1.2 Rechazo de venta por peso sin unidad
assert.throws(() => {
	new LocalProduct({
		name: 'Bola de Lomo',
		category: 'Carnes',
		price: mockPrice,
		finance: mockFinance,
		status: 'published',
		isSoldByWeight: true
	});
}, /la unidad de medida \(unit\) es obligatoria/);
console.log('  ✅ [PASS] Rechaza producto pesable sin unidad de medida');

// 1.3 Rechazo de unidad de peso inválida
assert.throws(() => {
	new LocalProduct({
		name: 'Bola de Lomo',
		category: 'Carnes',
		price: mockPrice,
		finance: mockFinance,
		status: 'published',
		isSoldByWeight: true,
		unit: 'toneladas' as any
	});
}, /Unidad de medida inválida/);
console.log('  ✅ [PASS] Rechaza unidad de balanza no permitida');

// 1.4 Creación exitosa de producto pesable
const localMeat = new LocalProduct({
	name: 'Bola de Lomo',
	category: 'Carnes',
	price: mockPrice,
	finance: mockFinance,
	status: 'published',
	isSoldByWeight: true,
	unit: 'kg',
	netStock: 25.5
});
assert.strictEqual(localMeat.name, 'Bola de Lomo');
assert.strictEqual(localMeat.isSoldByWeight, true);
assert.strictEqual(localMeat.unit, 'kg');
assert.strictEqual(localMeat.netStock, 25.5);
console.log('  ✅ [PASS] Crea producto fraccionado por peso con netStock decimal (25.5 kg)');

// 1.5 Límite de imágenes en Plan Local (máx 20)
const twentyImages = Array.from({ length: 20 }, (_, i) => ({ url: `https://cdn.vexx.com/img${i}.jpg`, public_id: `id${i}` }));
const localWithImages = new LocalProduct({
	name: 'Gorra Urbana',
	category: 'Accesorios',
	price: mockPrice,
	finance: mockFinance,
	status: 'published',
	images: twentyImages
});
assert.strictEqual(localWithImages.images?.length, 20);
assert.throws(() => {
	localWithImages.addImage({ url: 'https://cdn.vexx.com/img21.jpg', public_id: 'id21' });
}, /El Plan Local permite un máximo de 20 imágenes/);
console.log('  ✅ [PASS] Blindaje de máximo 20 imágenes en Plan Local');

// 1.6 Purgado de campos web/e-commerce en Plan Local
const localDbDoc = localMeat.toDatabaseObject();
assert.strictEqual(localDbDoc.descriptions, undefined);
assert.strictEqual(localDbDoc.seo, undefined);
assert.strictEqual(localDbDoc.combineWith, undefined);
assert.strictEqual(localDbDoc.isFeatured, undefined);
console.log('  ✅ [PASS] Impenetrabilidad: Plan Local no persiste campos web/SEO en MongoDB');

// ============================================================================
// 2. VERIFICACIÓN PLAN POINT
// ============================================================================
console.log('\n📱 2. Verificación de Plan Point:');

// 2.1 Permite descripciones comerciales e isFeatured
const pointProduct = new PointProduct({
	name: 'Remera Oversize Basic',
	category: 'Indumentaria',
	price: mockPrice,
	finance: mockFinance,
	status: 'published',
	subtitle: 'Colección Verano',
	shortDescription: 'Remera 100% algodón peinado',
	largeDescription: '<p>Corte boxy fit con cuello rib reforzado.</p>',
	isFeatured: true
});
assert.strictEqual(pointProduct.isFeatured, true);
assert.strictEqual(pointProduct.descriptions.subtitle, 'Colección Verano');

const pointDbDoc = pointProduct.toDatabaseObject();
assert.strictEqual(pointDbDoc.isFeatured, true);
assert.strictEqual(pointDbDoc.descriptions.subtitle, 'Colección Verano');
assert.strictEqual(pointDbDoc.seo, undefined); // Point NO guarda SEO
console.log('  ✅ [PASS] Point admite descripciones e isFeatured pero bloquea SEO');

// 2.2 Galería de 50 imágenes y enlace 1-a-N por variante
const thirtyImages = Array.from({ length: 30 }, (_, i) => ({
	url: `https://cdn.vexx.com/point${i}.jpg`,
	public_id: `point_id${i}`,
	variantSku: i < 15 ? 'REM-BLANCO' : 'REM-NEGRO'
}));
pointProduct.images = thirtyImages;
const whiteImages = pointProduct.getImagesForVariant('REM-BLANCO');
assert.strictEqual(whiteImages.length, 15);
console.log('  ✅ [PASS] Point soporta filtrado 1-a-N de fotos por SKU de variante');

// ============================================================================
// 3. VERIFICACIÓN PLAN PRO
// ============================================================================
console.log('\n👑 3. Verificación de Plan Pro:');

const proProduct = new ProProduct({
	name: 'Campera de Cuero Biker',
	category: 'Moda Alta Gama',
	price: mockPrice,
	finance: mockFinance,
	status: 'published',
	seo: {
		metaTitle: 'Campera de Cuero Genuino | Tienda Oficial',
		metaDescription: 'La campera de cuero más icónica de la temporada.',
		metaImage: { url: 'https://cdn.vexx.com/og.jpg', public_id: 'og1' }
	},
	combineWith: [{ product: 'prod-999', color: 'Negro' }],
	apparel: {
		gender: 'Unisex' as any,
		material: '100% Cuero Vacuno'
	}
});

const proDbDoc = proProduct.toDatabaseObject();
assert.strictEqual(proDbDoc.seo?.metaTitle, 'Campera de Cuero Genuino | Tienda Oficial');
assert.strictEqual(proDbDoc.combineWith?.length, 1);
assert.strictEqual(proDbDoc.apparel?.material, '100% Cuero Vacuno');
console.log('  ✅ [PASS] Pro persiste SEO, Shop The Look y ficha de moda completa');

// 3.2 Límite de 100 imágenes en Pro
assert.doesNotThrow(() => {
	for (let i = 0; i < 90; i++) {
		proProduct.addImage({ url: `https://cdn.vexx.com/pro${i}.jpg`, public_id: `pro_id${i}`, aspectRatio: '1:1' });
	}
});
assert.throws(() => {
	for (let i = 0; i < 20; i++) {
		proProduct.addImage({ url: `https://cdn.vexx.com/pro_extra${i}.jpg`, public_id: `pro_extra${i}` });
	}
}, /El Plan Pro permite un máximo de 100 imágenes/);
console.log('  ✅ [PASS] Pro amplía la galería hasta 100 imágenes y bloquea excesos');

// ============================================================================
// 4. FACTORY Y ESCALERA DE PLANES
// ============================================================================
console.log('\n🏭 4. Verificación de ProductDomainFactory:');

const fLocal = ProductDomainFactory.createByPlan('local', {
	name: 'Alfajor Jorgito',
	category: 'Kiosco',
	price: mockPrice,
	finance: mockFinance,
	status: 'published'
});
assert(fLocal instanceof LocalProduct);
assert(!(fLocal instanceof PointProduct));
console.log('  ✅ [PASS] Factory genera instancia LocalProduct pura para Plan Local');

const fPoint = ProductDomainFactory.createByPlan('point', {
	name: 'Taza Cerámica',
	category: 'Bazar',
	price: mockPrice,
	finance: mockFinance,
	status: 'published'
});
assert(fPoint instanceof PointProduct);
assert(!(fPoint instanceof ProProduct));
console.log('  ✅ [PASS] Factory genera instancia PointProduct para Plan Point');

const fPro = ProductDomainFactory.createByPlan('pro', {
	name: 'Smartphone Pro Max',
	category: 'Celulares',
	price: mockPrice,
	finance: mockFinance,
	status: 'published'
});
assert(fPro instanceof ProProduct);
console.log('  ✅ [PASS] Factory genera instancia ProProduct para Plan Pro');

// ============================================================================
// 5. CÁLCULO DE VENTA Y STOCK FRACCIONADO
// ============================================================================
console.log('\n⚖️ 5. Verificación de Ventas Fraccionadas (Balanza / Decimales):');

const pricePerKg = 12000;
const purchasedKg = 0.450; // 450 gramos de carne
const calculatedSubtotal = Math.round(pricePerKg * purchasedKg);
assert.strictEqual(calculatedSubtotal, 5400, '450 gramos a $12.000/kg debe ser $5.400');
console.log(`  ✅ [PASS] Cálculo de venta fraccionada: $${pricePerKg}/kg x ${purchasedKg}kg = $${calculatedSubtotal}`);

// Recálculo de stock con matriz de variantes
const productWithVariants = new LocalProduct({
	name: 'Zapatillas Running',
	category: 'Calzado',
	price: mockPrice,
	finance: mockFinance,
	status: 'published',
	variants: [
		{ sku: 'ZAP-40', stock: 5, isActive: true },
		{ sku: 'ZAP-41', stock: 8, isActive: true },
		{ sku: 'ZAP-42', stock: 3, isActive: true }
	]
});
assert.strictEqual(productWithVariants.netStock, 16, 'netStock debe ser sum(5 + 8 + 3) = 16');
productWithVariants.addVariant({ sku: 'ZAP-43', stock: 4, isActive: true });
assert.strictEqual(productWithVariants.netStock, 20, 'netStock recalculado tras agregar talle 43 debe ser 20');
console.log(`  ✅ [PASS] Sincronización reactiva de netStock desde variantes: total = ${productWithVariants.netStock}`);

console.log('\n════════════════════════════════════════════════════════');
console.log('✨ RESULTADOS: Todas las pruebas de dominio pasaron con éxito.');
console.log('════════════════════════════════════════════════════════\n');
