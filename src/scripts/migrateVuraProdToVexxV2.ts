/**
 * Migración de Productos y Config de Vura (Prod Export -> Vexx V2 Estricto)
 *
 * Uso seguro (SIEMPRE sobre .env.development / localhost:27017):
 *   Dry-run (solo lectura):
 *     pnpm ts-node -r tsconfig-paths/register src/scripts/migrateVuraProdToVexxV2.ts
 *   Aplicar cambios:
 *     pnpm ts-node -r tsconfig-paths/register src/scripts/migrateVuraProdToVexxV2.ts --apply
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

import crypto from 'crypto';
import mongoose from 'mongoose';
import { PriceBuilderEngine } from '@/addons/price_builder';
import { ICostConcept } from '@/interfaces/product.interface';

const APPLY = process.argv.includes('--apply');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');
const TARGET_DB =
	process.argv.find((a) => a.startsWith('--db='))?.split('=')[1] || 'vura_store_db';

function inferAspectRatio(width?: number, height?: number): string | undefined {
	if (!width || !height || width <= 0 || height <= 0) return undefined;
	const ratio = width / height;
	if (Math.abs(ratio - 0.8) < 0.08) return '4:5';
	if (Math.abs(ratio - 1) < 0.08) return '1:1';
	if (Math.abs(ratio - 1.777) < 0.1) return '16:9';
	if (Math.abs(ratio - 0.75) < 0.08) return '3:4';
	return 'original';
}

function cleanText(val: unknown): string | undefined {
	if (typeof val !== 'string') return undefined;
	const t = val.trim();
	return t.length > 0 ? t : undefined;
}

async function main() {
	const mongoUri = process.env.MONGODB_URI;
	if (!mongoUri) {
		console.error('❌ Falta MONGODB_URI en .env.development');
		process.exit(1);
	}

	if ((mongoUri.includes('mongodb+srv://') || mongoUri.includes('prod.')) && !ALLOW_REMOTE) {
		console.error('🛑 BLOQUEO DE SEGURIDAD: MONGODB_URI apunta a un cluster remoto/producción.');
		console.error('   Este script solo debe correr en desarrollo (localhost:27017).');
		process.exit(1);
	}

	console.log('\n============================================================');
	console.log(`🚀 Migración Vura -> Vexx V2 | DB: [${TARGET_DB}]`);
	console.log(`   Modo: ${APPLY ? '⚡ APPLY (escritura real)' : '🔍 DRY RUN (solo lectura)'}`);
	console.log('============================================================\n');

	const baseConn = await mongoose.createConnection(mongoUri).asPromise();
	const db = baseConn.useDb(TARGET_DB);
	const productsCol = db.collection('products');
	const configCol = db.collection('ecommerceconfigs');

	const config = (await configCol.findOne({ key: 'global_config' })) || (await configCol.findOne());
	if (!config) {
		console.error(`❌ No se encontró EcommerceConfig en ${TARGET_DB}.ecommerceconfigs`);
		await baseConn.close();
		process.exit(1);
	}

	// Normalizar configuración mínima requerida por Vexx V2 sin fallbacks silenciosos
	const normalizedConfig: any = {
		...config,
		businessType: config.businessType || 'fashion',
		costCurrency: config.costCurrency || 'ARS',
		taxes: config.taxes || { iva: 21 },
		pricingStrategy: {
			...config.pricingStrategy,
			method: config.pricingStrategy?.method || 'margin',
			priceRoundingMode: config.pricingStrategy?.priceRoundingMode || '100',
			defaultProfitMargin: config.pricingStrategy?.defaultProfitMargin ?? 33
		},
		authConfig: config.authConfig || {
			allowEmailPassword: true,
			allowMagicCode: true,
			allowGoogle: true,
			defaultMethod: 'magic_code'
		}
	};

	if (APPLY) {
		await configCol.updateOne(
			{ _id: config._id },
			{
				$set: {
					businessType: normalizedConfig.businessType,
					costCurrency: normalizedConfig.costCurrency,
					taxes: normalizedConfig.taxes,
					pricingStrategy: normalizedConfig.pricingStrategy,
					authConfig: normalizedConfig.authConfig
				}
			}
		);
		console.log('✅ EcommerceConfig normalizada para Vexx V2.\n');
	} else {
		console.log('ℹ️ [DRY RUN] EcommerceConfig lista para normalizar.\n');
	}

	const products = await productsCol.find({}).toArray();
	console.log(`📦 Productos encontrados: ${products.length}`);

	let migrated = 0;
	let skippedNoCost = 0;
	let errors = 0;
	let imagesLinkedCount = 0;
	let descriptionsMovedCount = 0;

	for (const doc of products) {
		try {
			const providerCost = Number(doc.finance?.providerCost?.inARS ?? doc.finance?.cost ?? 0);
			if (!Number.isFinite(providerCost) || providerCost <= 0) {
				skippedNoCost++;
				console.warn(`⚠️ [${doc.model}] sin providerCost.inARS válido (${providerCost}); se omite recálculo de precio.`);
				continue;
			}

			const additionalCosts: ICostConcept[] = Array.isArray(doc.finance?.additionalCosts)
				? doc.finance.additionalCosts.map((c: any) => ({
						concept: String(c.concept || 'Costo adicional'),
						value: Number(c.value || 0),
						type: c.type === 'percent_over_provider' ? 'percent_over_provider' : 'fixed',
						category: c.category === 'discount' ? 'discount' : 'expense'
					}))
				: [];

			const targetProfit = Number(doc.customProfitMargin ?? doc.finance?.pricingStrategy?.targetProfit);
			const useCustomProfit = Number.isFinite(targetProfit) && targetProfit > 0;
			const pricingMethodChoice =
				doc.finance?.pricingStrategy?.method === 'markup' ? 'markup' : 'margin';

			const calc = PriceBuilderEngine.calculate({
				providerCost,
				additionalCosts,
				useCustomProfit,
				customProfitMargin: useCustomProfit ? targetProfit : undefined,
				pricingMethodChoice,
				dolar: 1,
				config: normalizedConfig
			});

			const transferChannel = calc.price.channels.transfer;
			const computedDiscount =
				transferChannel?.discountPercent !== undefined
					? transferChannel.discountPercent
					: calc.price.listPrice > 0
						? Math.max(
								0,
								Math.round(((calc.price.listPrice - calc.price.cashTransferPrice) / calc.price.listPrice) * 100)
							)
						: 0;

			const newPrice = {
				...calc.price,
				discountPercentageTransfer: computedDiscount
			};

			// 2. Migrar images[] + variants[].imageReference -> images[].variantSkus
			const rawImages: any[] = Array.isArray(doc.images) ? doc.images.map((img: any) => ({ ...img })) : [];
			for (const img of rawImages) {
				if (!img.id) img.id = crypto.randomUUID();
				if (!img.aspectRatio) {
					const ar = inferAspectRatio(img.width, img.height);
					if (ar) img.aspectRatio = ar;
				}
				if (!Array.isArray(img.variantSkus)) img.variantSkus = [];
			}

			const rawVariants: any[] = Array.isArray(doc.variants) ? doc.variants : [];
			const cleanedVariants = rawVariants.map((v: any) => {
				const copy = { ...v };
				const ref = copy.imageReference;
				if (ref && (ref.public_id || ref.url) && copy.sku) {
					let targetImg = rawImages.find(
						(img) =>
							(ref.public_id && img.public_id === ref.public_id) ||
							(ref.url && img.url === ref.url)
					);
					if (!targetImg && ref.url) {
						targetImg = {
							id: crypto.randomUUID(),
							url: ref.url,
							public_id: ref.public_id || `migrated_${crypto.randomUUID()}`,
							variantSkus: []
						};
						rawImages.push(targetImg);
					}
					if (targetImg && !targetImg.variantSkus.includes(copy.sku)) {
						targetImg.variantSkus.push(copy.sku);
						imagesLinkedCount++;
					}
				}
				delete copy.imageReference;
				return copy;
			});

			// 3. Migrar descriptions (raíz -> objeto descriptions)
			const sub = cleanText(doc.descriptions?.subtitle ?? doc.subtitle);
			const shortDesc = cleanText(doc.descriptions?.shortDescription ?? doc.shortDescription);
			const largeDesc = cleanText(doc.descriptions?.largeDescription ?? doc.largeDescription);
			const newDescriptions: Record<string, string> = {};
			if (sub) newDescriptions.subtitle = sub;
			if (shortDesc) newDescriptions.shortDescription = shortDesc;
			if (largeDesc) newDescriptions.largeDescription = largeDesc;
			if (Object.keys(newDescriptions).length > 0 && !doc.descriptions) {
				descriptionsMovedCount++;
			}

			// 4. Construir $set y $unset limpios
			const $set: Record<string, unknown> = {
				price: newPrice,
				finance: calc.finance,
				images: rawImages,
				variants: cleanedVariants
			};
			const $unset: Record<string, 1> = {
				customProfitMargin: 1,
				subtitle: 1,
				shortDescription: 1,
				largeDescription: 1,
				features: 1
			};

			if (Object.keys(newDescriptions).length > 0) {
				$set.descriptions = newDescriptions;
			} else {
				$unset.descriptions = 1;
			}

			if (!Array.isArray(doc.careInstructions) || doc.careInstructions.length === 0) {
				$unset.careInstructions = 1;
			}
			if (!Array.isArray(doc.tags) || doc.tags.length === 0) {
				$unset.tags = 1;
			}
			if (!Array.isArray(doc.specifications) || doc.specifications.length === 0) {
				$unset.specifications = 1;
			}
			if (!doc.sizeGuide || !Array.isArray(doc.sizeGuide.rows) || doc.sizeGuide.rows.length === 0) {
				$unset.sizeGuide = 1;
			}
			if (!Array.isArray(doc.combineWith) || doc.combineWith.length === 0) {
				$unset.combineWith = 1;
			}

			if (APPLY) {
				await productsCol.updateOne({ _id: doc._id }, { $set, $unset });
			}
			migrated++;
		} catch (err: any) {
			errors++;
			console.error(`❌ Error migrando [${doc.model}] (${doc._id}):`, err?.message || err);
		}
	}

	console.log('\n🏁 Resumen:');
	console.log(`   - Productos procesados OK: ${migrated}`);
	console.log(`   - Omitidos por falta de costo: ${skippedNoCost}`);
	console.log(`   - Errores: ${errors}`);
	console.log(`   - Variantes vinculadas a images[].variantSkus: ${imagesLinkedCount}`);
	console.log(`   - Productos con descriptions migradas: ${descriptionsMovedCount}`);
	if (!APPLY) {
		console.log('\n💡 Fue un DRY RUN. Para aplicar los cambios en desarrollo, ejecutá con --apply');
	}

	await baseConn.close();
}

main().catch((err) => {
	console.error('❌ Error fatal:', err);
	process.exit(1);
});
