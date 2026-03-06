/**
 * Migrar datos de electro-hub → electromix_db
 * 
 * Copia todas las colecciones de una DB a otra y opcionalmente borra la vieja.
 * 
 * Ejecutar: npx ts-node -r tsconfig-paths/register src/scripts/migrate-db.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const SOURCE_DB = 'electro-hub';
const TARGET_DB = 'electromix_db';

async function migrateDb() {
	const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

	console.log(`\n🔄 Migrando: ${SOURCE_DB} → ${TARGET_DB}\n`);

	const conn = await mongoose.createConnection(mongoURI).asPromise();

	const sourceDb = conn.useDb(SOURCE_DB);
	const targetDb = conn.useDb(TARGET_DB);

	// Obtener todas las colecciones de la DB origen
	const collections = await sourceDb.db!.listCollections().toArray();

	if (collections.length === 0) {
		console.log('❌ No hay colecciones en la DB origen');
		await conn.close();
		process.exit(1);
	}

	console.log(`📊 Colecciones encontradas: ${collections.length}`);

	for (const col of collections) {
		const name = col.name;
		console.log(`\n📁 Migrando: ${name}...`);

		const sourceCollection = sourceDb.db!.collection(name);
		const targetCollection = targetDb.db!.collection(name);

		// Contar documentos
		const count = await sourceCollection.countDocuments();
		console.log(`   📄 ${count} documentos`);

		if (count === 0) {
			console.log(`   ⏭️  Vacía, saltando`);
			continue;
		}

		// Verificar si ya existen datos en target
		const existingCount = await targetCollection.countDocuments();
		if (existingCount > 0) {
			console.log(`   ⚠️  Ya tiene ${existingCount} docs en destino. Saltando para no duplicar.`);
			continue;
		}

		// Copiar todos los documentos
		const docs = await sourceCollection.find({}).toArray();
		await targetCollection.insertMany(docs);
		console.log(`   ✅ ${docs.length} documentos copiados`);

		// Copiar índices
		const indexes = await sourceCollection.indexes();
		for (const index of indexes) {
			if (index.name === '_id_') continue; // _id_ se crea automáticamente
			try {
				const { key, ...options } = index;
				delete (options as any).v;
				delete (options as any).ns;
				await targetCollection.createIndex(key, options);
				console.log(`   🔑 Índice: ${index.name}`);
			} catch (err: any) {
				console.log(`   ⚠️  Índice ${index.name}: ${err.message}`);
			}
		}
	}

	console.log('\n🏁 ¡Migración completada!');
	console.log(`\n🗑️  Para borrar la DB vieja, abrí MongoDB Compass y eliminá "${SOURCE_DB}"`);

	await conn.close();
	process.exit(0);
}

migrateDb().catch((err) => {
	console.error('❌ Error:', err);
	process.exit(1);
});
