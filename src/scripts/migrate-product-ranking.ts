/**
 * 🏆 Migración de Ranking ELO y Métricas — Vura DB
 *
 * Inicializa para todos los productos existentes:
 *   rankingScore: 100 (si no tiene)
 *   effectiveScore: 100 (si no tiene)
 *   metrics: { viewsCount: 0, cartAddsCount: 0, salesCount: 0 } (si no tiene)
 *
 * Inicializa en EcommerceConfig:
 *   catalogRanking: { active: false, viewWeight: 1, cartWeight: 5, saleWeight: 25 }
 *
 * Ejecución:
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrate-product-ranking.ts --apply
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const VURA_DB = process.env.VURA_DB_NAME || 'vura_store_db';
const DRY_RUN = !process.argv.includes('--apply');

async function migrateRanking() {
	const mongoURI = process.env.MONGODB_URI;
	if (!mongoURI) {
		console.error('❌ MONGODB_URI no está definida en .env');
		process.exit(1);
	}

	console.log('\n🏆 ═══════════════════════════════════════════════════');
	console.log('   Migración de Ranking ELO & Métricas — Vura DB');
	console.log(`   Modo: ${DRY_RUN ? '🔍 DRY RUN (solo lectura)' : '⚡ APPLY (escritura real)'}`);
	console.log('═══════════════════════════════════════════════════════\n');

	if (DRY_RUN) {
		console.log('💡 Tip: Pasá --apply para ejecutar los cambios reales en MongoDB.\n');
	}

	const conn = await mongoose.createConnection(mongoURI).asPromise();
	const db = conn.useDb(VURA_DB);
	const productsCollection = db.collection('products');
	const configCollection = db.collection('ecommerceconfigs');

	// 1. Auditar productos existentes
	const totalProducts = await productsCollection.countDocuments();
	console.log(`📦 Total de productos encontrados en [${VURA_DB}]: ${totalProducts}`);

	const unrankedProducts = await productsCollection.countDocuments({
		$or: [
			{ rankingScore: { $exists: false } },
			{ effectiveScore: { $exists: false } },
			{ metrics: { $exists: false } }
		]
	});

	console.log(`🔍 Productos que necesitan inicialización de Ranking: ${unrankedProducts}`);

	if (!DRY_RUN && unrankedProducts > 0) {
		const result = await productsCollection.updateMany(
			{
				$or: [
					{ rankingScore: { $exists: false } },
					{ effectiveScore: { $exists: false } },
					{ metrics: { $exists: false } }
				]
			},
			{
				$set: {
					rankingScore: 100,
					effectiveScore: 100,
					'metrics.viewsCount': 0,
					'metrics.cartAddsCount': 0,
					'metrics.salesCount': 0
				}
			}
		);
		console.log(`✅ ${result.modifiedCount} productos actualizados con rankingScore: 100 y métricas en 0.`);
	}

	// 2. Auditar / Actualizar configuración de catálogo
	const config = await configCollection.findOne({ key: 'global_config' });
	if (!config) {
		console.log('ℹ️ No se encontró global_config en ecommerceconfigs, creando con catalogRanking por defecto...');
		if (!DRY_RUN) {
			await configCollection.insertOne({
				key: 'global_config',
				catalogRanking: {
					active: false,
					viewWeight: 1,
					cartWeight: 5,
					saleWeight: 25
				}
			});
			console.log('✅ Configuración inicial creada.');
		}
	} else if (!config.catalogRanking) {
		console.log('ℹ️ catalogRanking no existe en global_config. Agregando con active: false...');
		if (!DRY_RUN) {
			await configCollection.updateOne(
				{ key: 'global_config' },
				{
					$set: {
						catalogRanking: {
							active: false,
							viewWeight: 1,
							cartWeight: 5,
							saleWeight: 25
						}
					}
				}
			);
			console.log('✅ catalogRanking agregado a global_config.');
		}
	} else {
		console.log(`ℹ️ catalogRanking ya existe en global_config (active: ${config.catalogRanking.active}).`);
	}

	console.log('\n🎉 Migración finalizada con éxito.');
	await conn.close();
	process.exit(0);
}

migrateRanking().catch((err) => {
	console.error('❌ Error fatal en migración:', err);
	process.exit(1);
});
