import assert from 'assert';
import sharp from 'sharp';
import { ImageService } from '../services/images.service';
import { resolveProductFormConfig } from '../config/formCapabilities';
import { ProductDisplayService } from '../services/product/productDisplay.service';
import { buildProductSeoMetadata } from '../addons/product_seo/seoMetadata.builder';
import { CreateOrderSchema } from '../validators/order.schema';
import { UniversalVariantZodSchema } from '../validators/product.schema';

async function runTests() {
	console.log('=== Test 1: ImageService WebP optimization & multi-aspect crop ===');
	const rawPng = await sharp({
		create: {
			width: 1600,
			height: 900,
			channels: 3,
			background: { r: 220, g: 80, b: 80 },
		},
	})
		.png()
		.toBuffer();

	const optimized = await ImageService.optimizeBufferToWebP(rawPng, { quality: 100 });
	assert.strictEqual(optimized.format, 'webp');
	assert.ok(optimized.bytes > 0 && optimized.bytes < rawPng.length, 'WebP should be smaller than raw PNG');
	console.log(`  OK: PNG ${rawPng.length}B -> WebP q=100 ${optimized.bytes}B (${optimized.width}x${optimized.height})`);

	const cropped = await ImageService.processMediaStudioCrops(rawPng, [
		{ aspectRatio: 'original', xPct: 0, yPct: 0, wPct: 1, hPct: 1, quality: 100 },
		{ aspectRatio: '1:1', xPct: 0.21875, yPct: 0, wPct: 0.5625, hPct: 1 },
		{ aspectRatio: '4:5', xPct: 0.275, yPct: 0, wPct: 0.45, hPct: 1 },
		{ aspectRatio: '9:16', xPct: 0.34, yPct: 0, wPct: 0.3164, hPct: 1 },
		{ aspectRatio: '16:9', xPct: 0, yPct: 0, wPct: 1, hPct: 1 },
	]);
	assert.strictEqual(cropped.crops.length, 5);
	for (const c of cropped.crops) {
		assert.strictEqual(c.format, 'webp');
		assert.ok(c.width > 0 && c.height > 0);
		console.log(`  OK: Crop ${c.aspectRatio} -> ${c.width}x${c.height} (${c.bytes}B)`);
	}

	console.log('=== Test 2: resolveProductFormConfig (variantConfig & galleryConfig) ===');
	const proFashion = resolveProductFormConfig('fashion', 'pro', true, ['variants', 'media_studio', 'product_descriptions']);
	assert.strictEqual(proFashion.variantConfig.variantMode, 'fashion');
	assert.strictEqual(proFashion.galleryConfig.addonEnabled, true);
	assert.strictEqual(proFashion.galleryConfig.enableCropper, true);
	assert.strictEqual(proFashion.galleryConfig.autoOptimizeWebP, true);
	assert.strictEqual(proFashion.galleryConfig.defaultQuality, 100);
	assert.strictEqual(proFashion.galleryConfig.enableVariantTagging, true);
	assert.strictEqual(proFashion.descriptionConfig.addonEnabled, true);
	assert.strictEqual(proFashion.descriptionConfig.showRichDescription, true);

	const basicKiosk = resolveProductFormConfig('kiosk_grocery', 'local', false, ['variants', 'weighable']);
	assert.strictEqual(basicKiosk.variantConfig.variantMode, 'presentation');
	assert.strictEqual(basicKiosk.galleryConfig.addonEnabled, false);
	assert.strictEqual(basicKiosk.galleryConfig.enableCropper, false);
	assert.strictEqual(basicKiosk.galleryConfig.autoOptimizeWebP, true);
	assert.strictEqual(basicKiosk.descriptionConfig.addonEnabled, false);
	assert.strictEqual(basicKiosk.weighableConfig?.addonEnabled, true);
	assert.strictEqual(basicKiosk.weighableConfig?.defaultUnit, 'kg');
	assert.strictEqual(basicKiosk.weighableConfig?.allowFractionalVariants, true);
	assert.deepStrictEqual(basicKiosk.weighableConfig?.allowedUnits, ['kg', 'g', 'docena', 'un', 'l', 'ml']);

	const dynamicFerreteria = resolveProductFormConfig(
		'ferreteria',
		'point',
		true,
		['variants', 'media_studio'],
		{ variantsTitle: 'Medidas & Calibres' },
		{
			variantMode: 'presentation',
			variantColumns: { showVolumeColumn: true, showColorColumn: false, showSizeColumn: false, showAttributesColumn: false },
			defaultAspectRatios: ['1:1', '4:5']
		}
	);
	assert.strictEqual(dynamicFerreteria.variantConfig.variantMode, 'presentation');
	assert.strictEqual(dynamicFerreteria.labels.variantsTitle, 'Medidas & Calibres');
	assert.deepStrictEqual(dynamicFerreteria.galleryConfig.allowedAspectRatios, ['1:1', '4:5']);
	console.log('  OK: variantConfig & galleryConfig resolved accurately for fashion+pro, kiosk_grocery+local, and dynamic ferreteria');

	console.log('=== Test 3: ProductDisplayService.buildVariantAxes ===');
	const sodaProduct = {
		images: [
			{ id: 'img_1', url: 'https://cdn/1l.webp', public_id: '1l', variantSkus: ['COCA-1L'] },
			{ id: 'img_3', url: 'https://cdn/3l.webp', public_id: '3l', variantSkus: ['COCA-3L'] },
		],
		variants: [
			{ sku: 'COCA-1L', volume: '1 Litro', stock: 10, isActive: true },
			{ sku: 'COCA-225L', volume: '2.25 Litros', stock: 5, isActive: true },
			{ sku: 'COCA-3L', volume: '3 Litros', stock: 0, isActive: true },
		],
	} as any;
	const sodaAxes = ProductDisplayService.buildVariantAxes(sodaProduct);
	assert.strictEqual(sodaAxes.length, 1);
	assert.strictEqual(sodaAxes[0].key, 'volume');
	assert.strictEqual(sodaAxes[0].type, 'pill');
	assert.strictEqual(sodaAxes[0].options.length, 3);
	assert.strictEqual(sodaAxes[0].options[2].available, false);
	assert.deepStrictEqual(sodaAxes[0].options[0].imageIds, ['img_1']);

	const fashionProduct = {
		images: [
			{ id: 'img_negro', url: 'https://cdn/negro.webp', public_id: 'negro', variantSkus: ['REM-NEG-M'] },
		],
		variants: [
			{ sku: 'REM-NEG-M', color: { name: 'Negro', hex: '#111111' }, size: 'M', stock: 4, isActive: true },
		],
	} as any;
	const fashionAxes = ProductDisplayService.buildVariantAxes(fashionProduct);
	assert.strictEqual(fashionAxes.length, 2);
	assert.strictEqual(fashionAxes[0].key, 'color');
	assert.strictEqual(fashionAxes[0].type, 'swatch');
	assert.deepStrictEqual(fashionAxes[0].options[0].imageIds, ['img_negro']);
	assert.strictEqual(fashionAxes[1].key, 'size');
	console.log('  OK: buildVariantAxes handles color-less presentations and multi-axis fashion variants');

	console.log('=== Test 4: Weighable & Universal Variant Zod Schemas ===');
	const cartItem = CreateOrderSchema.shape.body.shape.items.element.parse({
		_id: '65f1a2b3c4d5e6f7a8b9c0d1',
		sku: 'BAN-ECU',
		quantity: 0.75,
	});
	assert.strictEqual(cartItem.quantity, 0.75);

	const universalVariant = UniversalVariantZodSchema.parse({
		sku: 'BAN-ECU',
		stock: 12.5,
		volume: 'Ecuador',
		inheritPrice: false,
		providerCost: 1200,
		profitMargin: 35,
	});
	assert.strictEqual(universalVariant.stock, 12.5);
	assert.strictEqual(universalVariant.inheritPrice, false);
	console.log('  OK: Decimal quantities & universal variant fields pass Zod validation');

	console.log('=== Test 5: Product SEO (Open Graph + JSON-LD + POINT vs PRO) ===');
	const pointSeo = resolveProductFormConfig('fashion', 'point', true, ['product_seo']);
	assert.strictEqual(pointSeo.seoConfig.addonEnabled, true);
	assert.strictEqual(pointSeo.seoConfig.showMetaImage, true);
	assert.strictEqual(pointSeo.seoConfig.enableJsonLd, false);
	const proSeo = resolveProductFormConfig('fashion', 'pro', true, ['product_seo']);
	assert.strictEqual(proSeo.seoConfig.enableJsonLd, true);

	const seoMeta = buildProductSeoMetadata({
		product: {
			name: 'Camisa Dalia',
			slug: 'camisa-dalia',
			brand: 'Vura',
			netStock: 10,
			price: { listPrice: 51400, cashTransferPrice: 46000 },
			seo: { metaTitle: 'Camisa Dalia | Vura', metaDescription: 'Voile bordado', metaImage: { url: 'https://cdn/og.jpg' } }
		},
		storeName: 'Vura',
		baseUrl: 'https://vura.com.ar',
		includeJsonLd: true
	});
	assert.strictEqual(seoMeta.openGraph['og:image:width'], 1200);
	assert.strictEqual(seoMeta.openGraph['og:image:height'], 630);
	assert.strictEqual((seoMeta.jsonLd as any)['@type'], 'Product');
	assert.strictEqual((seoMeta.jsonLd as any).offers.availability, 'https://schema.org/InStock');
	console.log('  OK: product_seo Open Graph 1200x630 & JSON-LD schema.org/Product verified');

	console.log('\nALL MEDIA STUDIO & VARIANT STUDIO TESTS PASSED.');
}

runTests().catch((err) => {
	console.error('TEST FAILED:', err);
	process.exit(1);
});
