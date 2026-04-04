/**
 * 🔄 Migración de Variantes — Vura DB (ClothingProducts)
 *
 * Convierte el schema genérico de variantes al nuevo ClothingVariantSchema:
 *   ANTES: variants[].attributes = [{ key: "Talle", value: "M" }, ...]
 *   DESPUÉS: variants[].size = "M"  (attributes eliminado)
 *
 * Ejecutar en DRY RUN primero (sin cambios reales):
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrate-clothing-variants.ts
 *
 * Ejecutar la migración real:
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrate-clothing-variants.ts --apply
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

// ─── Config ───────────────────────────────────────────────────────────────────

const VURA_DB = 'vura_store_db';
const DRY_RUN = !process.argv.includes('--apply');

// Claves posibles del atributo "talle" según cómo lo hayan cargado en el panel
const TALLE_KEYS = ['talle', 'size', 'Talle', 'Size', 'TALLE', 'SIZE'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSize(attributes: { key: string; value: string }[]): string {
	for (const key of TALLE_KEYS) {
		const attr = attributes.find((a) => a.key === key);
		if (attr?.value) return attr.value;
	}
	return ''; // Sin talle encontrado — se puede corregir manual
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function migrateClothingVariants() {
	const mongoURI = process.env.MONGODB_URI;
	if (!mongoURI) {
		console.error('❌ MONGODB_URI no está definida en .env');
		process.exit(1);
	}

	console.log('\n👕 ═══════════════════════════════════════════════════');
	console.log('   Migración de Variantes — Vura ClothingProducts');
	console.log(`   Modo: ${DRY_RUN ? '🔍 DRY RUN (solo lectura)' : '⚡ APPLY (escritura real)'}`);
	console.log('═══════════════════════════════════════════════════════\n');

	if (DRY_RUN) {
		console.log('💡 Tip: Pasá --apply para ejecutar los cambios reales.\n');
	}

	const conn = await mongoose.createConnection(mongoURI).asPromise();
	const db = conn.useDb(VURA_DB);
	const products = db.collection('products');

	// ── 1. Buscar todos los ClothingProducts con variantes ──────────────────

	const clothingDocs = await products
		.find({ productType: 'ClothingProduct', 'variants.0': { $exists: true } })
		.toArray();

	console.log(`📦 ClothingProducts con variantes encontrados: ${clothingDocs.length}\n`);

	if (clothingDocs.length === 0) {
		console.log('✅ Nada que migrar — DB ya está limpia o no hay productos.');
		await conn.close();
		process.exit(0);
	}

	// ── 2. Analizar y mostrar el plan ────────────────────────────────────────

	let totalVariants = 0;
	let withSize = 0;
	let withoutSize = 0;
	const warnings: string[] = [];

	for (const doc of clothingDocs) {
		const variants = (doc.variants || []) as any[];
		console.log(`📌 ${doc.brand} ${doc.model} (${variants.length} variantes)`);

		for (const v of variants) {
			totalVariants++;
			const attrs: { key: string; value: string }[] = v.attributes || [];
			const size = extractSize(attrs);

			if (size) {
				withSize++;
				console.log(`   ✅  SKU: ${v.sku} → size: "${size}"`);
			} else {
				withoutSize++;
				const allKeys = attrs.map((a) => `"${a.key}"`).join(', ');
				const msg = `   ⚠️  SKU: ${v.sku} → sin talle detectado (attrs: [${allKeys || 'none'}])`;
				console.log(msg);
				warnings.push(`${doc.brand} ${doc.model} — SKU ${v.sku}: sin talle detectado`);
			}
		}
		console.log('');
	}

	// ── 3. Resumen pre-migración ─────────────────────────────────────────────

	console.log('─────────────────────────────────────────────────────');
	console.log(`📊 Resumen:`);
	console.log(`   Productos a migrar:  ${clothingDocs.length}`);
	console.log(`   Variantes totales:   ${totalVariants}`);
	console.log(`   Con talle detectado: ${withSize}`);
	console.log(`   Sin talle (vacío):   ${withoutSize}`);
	if (warnings.length > 0) {
		console.log(`\n⚠️  Variantes sin talle detectado (quedarán size = ""):`);
		warnings.forEach((w) => console.log(`   - ${w}`));
	}
	console.log('─────────────────────────────────────────────────────\n');

	if (DRY_RUN) {
		console.log('🔍 Dry run completado. Verificá el plan y ejecutá con --apply.\n');
		await conn.close();
		process.exit(0);
	}

	// ── 4. Aplicar migración ─────────────────────────────────────────────────

	console.log('⚡ Aplicando migración...\n');

	let updated = 0;
	let failed = 0;

	for (const doc of clothingDocs) {
		try {
			const variants = (doc.variants || []) as any[];

			// Construimos el array de variantes transformadas
			const newVariants = variants.map((v: any) => {
				const attrs: { key: string; value: string }[] = v.attributes || [];
				const size = extractSize(attrs);

				// Nuevo variant: todo lo que tenía MENOS attributes, MÁS size
				const { attributes: _dropped, ...rest } = v;
				return { ...rest, size };
			});

			await products.updateOne(
				{ _id: doc._id },
				{ $set: { variants: newVariants } }
			);

			console.log(`✅ ${doc.brand} ${doc.model} — ${newVariants.length} variantes actualizadas`);
			updated++;
		} catch (err: any) {
			console.error(`❌ Error en ${doc.brand} ${doc.model}: ${err.message}`);
			failed++;
		}
	}

	// ── 5. Resultado final ───────────────────────────────────────────────────

	console.log('\n─────────────────────────────────────────────────────');
	console.log('🏁 Migración completada:');
	console.log(`   ✅ Actualizados: ${updated}`);
	console.log(`   ❌ Fallados:     ${failed}`);
	if (withoutSize > 0) {
		console.log(`\n⚠️  Hay ${withoutSize} variante(s) con size vacío.`);
		console.log('   Corregalas manualmente desde el panel de admin.');
	}
	console.log('');

	await conn.close();
	process.exit(failed > 0 ? 1 : 0);
}

migrateClothingVariants().catch((err) => {
	console.error('❌ Error fatal:', err);
	process.exit(1);
});
