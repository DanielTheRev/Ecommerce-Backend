import assert from 'assert';
import {
	LocalProduct,
	PointProduct,
	ProProduct,
	ProductDomainFactory
} from '@/domain/product/product.classes';

console.log('🧪 ========================================================');
console.log('   SUITE DE PRUEBAS: VARIANTES DE PRODUCTO UNIVERSALES');
console.log('========================================================\n');

const mockPrice: any = {
	listPrice: 20000,
	card_ticket1PayPrice: 19000,
	cashTransferPrice: 17000,
	discountPercentageTransfer: 15,
	installments: {
		threePaymentsAmount: 7000,
		sixPaymentsAmount: 3900,
		hasThreeInstallmentsSeamless: true,
		hasSixInstallmentsSeamless: false
	}
};

const mockFinance: any = {
	exchangeRateSnapshot: 1250,
	mpCommissionSnapshot: { base: 6.5, cft3Cuotas: 12.5, cft6Cuotas: 22.0 },
	providerCost: { inUSD: 10, inARS: 12500 },
	additionalCosts: [],
	pricingStrategy: { method: 'markup', targetProfit: 25 },
	calculatedProfits: { transfer: 3000, card_ticket1Pay: 2500, card3Installments: 2000, card6Installments: 1500 }
};

// ============================================================================
// CASO 1: INDUMENTARIA / MODA (VURA / TIENDA DE ROPA)
// ============================================================================
console.log('👗 CASO 1: Indumentaria / Moda (Talles, Colores y Fotos por Variante):');

const fashionProduct = new PointProduct({
	name: 'Remera Heavyweight Oversize',
	category: 'Indumentaria',
	brand: 'Vura Originals',
	price: mockPrice, // $20.000 precio base
	finance: mockFinance,
	status: 'published',
	variants: [
		// Remeras Negras (S, M, L)
		{
			sku: 'REM-OVR-NEG-S',
			size: 'S',
			color: { name: 'Negro', hex: '#000000' },
			stock: 10,
			isActive: true
		},
		{
			sku: 'REM-OVR-NEG-M',
			size: 'M',
			color: { name: 'Negro', hex: '#000000' },
			stock: 15,
			isActive: true
		},
		{
			sku: 'REM-OVR-NEG-L',
			size: 'L',
			color: { name: 'Negro', hex: '#000000' },
			stock: 8,
			isActive: true
		},
		// Remeras Blancas (S, M)
		{
			sku: 'REM-OVR-BLA-S',
			size: 'S',
			color: { name: 'Blanco', hex: '#FFFFFF' },
			stock: 6,
			isActive: true
		},
		{
			sku: 'REM-OVR-BLA-M',
			size: 'M',
			color: { name: 'Blanco', hex: '#FFFFFF' },
			stock: 12,
			isActive: true
		}
	],
	images: [
		{ url: 'https://cdn.vexx.app/negro-front.jpg', public_id: 'img1', variantSku: 'REM-OVR-NEG-S', colorName: 'Negro', isMain: true },
		{ url: 'https://cdn.vexx.app/negro-back.jpg', public_id: 'img2', variantSku: 'REM-OVR-NEG-M', colorName: 'Negro' },
		{ url: 'https://cdn.vexx.app/blanco-front.jpg', public_id: 'img3', variantSku: 'REM-OVR-BLA-S', colorName: 'Blanco' }
	]
});

// Verificaciones de Indumentaria
assert.strictEqual(fashionProduct.variants!.length, 5, 'Debe tener 5 variantes cargadas');
assert.strictEqual(fashionProduct.netStock, 51, 'netStock debe ser sum(10+15+8+6+12) = 51 unidades');

// Filtrado de fotos por color para el frontend
const blackPhotos = fashionProduct.images?.filter(img => img.colorName === 'Negro');
assert.strictEqual(blackPhotos?.length, 2, 'Deben existir 2 fotos asociadas al color Negro');

const whitePhotos = fashionProduct.images?.filter(img => img.colorName === 'Blanco');
assert.strictEqual(whitePhotos?.length, 1, 'Debe existir 1 foto asociada al color Blanco');

console.log(`  ✅ [PASS] Indumentaria: 5 variantes (S, M, L / Negro, Blanco) sincronizan netStock = ${fashionProduct.netStock}`);
console.log(`  ✅ [PASS] Indumentaria: Galería filtrable por color (${blackPhotos?.length} fotos Negras, ${whitePhotos?.length} Blancas)`);

// ============================================================================
// CASO 2: INDUMENTARIA CON PRECIO DIFERENCIADO EN TALLE ESPECIAL (XXL)
// ============================================================================
console.log('\n🏷️ CASO 2: Indumentaria con Talle Especial (Sobreescritura de Precio):');

// Agregamos talle XXL que vale más caro ($24.000 vs $20.000 base)
fashionProduct.addVariant({
	sku: 'REM-OVR-NEG-XXL',
	size: 'XXL',
	color: { name: 'Negro', hex: '#000000' },
	stock: 4,
	price: 24000, // <--- Sobreescritura opcional
	isActive: true
});

assert.strictEqual(fashionProduct.variants!.length, 6);
assert.strictEqual(fashionProduct.netStock, 55, 'netStock sumó 4 unidades de XXL = 55');

const standardVariant = fashionProduct.variants!.find(v => v.sku === 'REM-OVR-NEG-M');
const specialVariant = fashionProduct.variants!.find(v => v.sku === 'REM-OVR-NEG-XXL');

const standardPrice = standardVariant?.price ?? fashionProduct.price.listPrice;
const specialPrice = specialVariant?.price ?? fashionProduct.price.listPrice;

assert.strictEqual(standardPrice, 20000, 'Talle M usa el precio base del producto ($20.000)');
assert.strictEqual(specialPrice, 24000, 'Talle XXL usa su precio diferenciado ($24.000)');

console.log(`  ✅ [PASS] Talle standard (M) hereda precio base: $${standardPrice}`);
console.log(`  ✅ [PASS] Talle especial (XXL) aplica precio custom: $${specialPrice}`);

// ============================================================================
// CASO 3: COMERCIO MULTIRUBRO / BEBIDAS (COCA-COLA 1.5L vs 2.25L)
// ============================================================================
console.log('\n🥤 CASO 3: Bebidas / Almacén (Variantes con Precios y Códigos de Barra Únicos):');

const sodaProduct = new LocalProduct({
	name: 'Coca Cola Sabor Original',
	category: 'Bebidas',
	price: { listPrice: 1500 } as any, // Precio de referencia base (500ml)
	finance: mockFinance,
	status: 'published',
	variants: [
		{
			sku: 'COCA-500ML',
			size: '500ml',
			barcode: '7791234000500',
			price: 1500,
			stock: 48,
			isActive: true
		},
		{
			sku: 'COCA-1.5L',
			size: '1.5L',
			barcode: '7791234001500',
			price: 2600,
			stock: 24,
			isActive: true
		},
		{
			sku: 'COCA-2.25L',
			size: '2.25L',
			barcode: '7791234002250',
			price: 3500,
			stock: 30,
			isActive: true
		}
	]
});

assert.strictEqual(sodaProduct.variants!.length, 3);
assert.strictEqual(sodaProduct.netStock, 102, 'Total de botellas: 48 + 24 + 30 = 102');

const v500 = sodaProduct.variants!.find(v => v.size === '500ml');
const v15 = sodaProduct.variants!.find(v => v.size === '1.5L');
const v225 = sodaProduct.variants!.find(v => v.size === '2.25L');

assert.strictEqual(v500?.price, 1500);
assert.strictEqual(v15?.price, 2600);
assert.strictEqual(v225?.price, 3500);

assert.strictEqual(v15?.barcode, '7791234001500', 'Cada presentación tiene su propio código EAN');

console.log(`  ✅ [PASS] 500ml:  $${v500?.price} | Stock: ${v500?.stock} | Barcode: ${v500?.barcode}`);
console.log(`  ✅ [PASS] 1.5L:   $${v15?.price} | Stock: ${v15?.stock} | Barcode: ${v15?.barcode}`);
console.log(`  ✅ [PASS] 2.25L:  $${v225?.price} | Stock: ${v225?.stock} | Barcode: ${v225?.barcode}`);

// ============================================================================
// CASO 4: CARNICERÍA (PACKS DE HAMBURGUESAS CASERAS)
// ============================================================================
console.log('\n🥩 CASO 4: Carnicería (Packs de Hamburguesas Caseras):');

const burgerProduct = new LocalProduct({
	name: 'Hamburguesas Caseras 100% Carne Vacuna',
	category: 'Carnicería',
	price: { listPrice: 4500 } as any,
	finance: mockFinance,
	status: 'published',
	variants: [
		{
			sku: 'HAMB-PACK-4',
			size: 'Pack x4 unidades',
			price: 4500,
			stock: 25,
			isActive: true
		},
		{
			sku: 'HAMB-PACK-8',
			size: 'Pack x8 unidades (Promo)',
			price: 8200,
			stock: 12,
			isActive: true
		}
	]
});

assert.strictEqual(burgerProduct.variants!.length, 2);
assert.strictEqual(burgerProduct.netStock, 37);
console.log(`  ✅ [PASS] Carnicería: Pack x4 ($4.500) y Pack x8 ($8.200) conviven en un solo producto con stock = ${burgerProduct.netStock}`);

console.log('\n════════════════════════════════════════════════════════');
console.log('✨ TODAS LAS PRUEBAS DE VARIANTES UNIVERSALES PASARON CON ÉXITO.');
console.log('════════════════════════════════════════════════════════\n');