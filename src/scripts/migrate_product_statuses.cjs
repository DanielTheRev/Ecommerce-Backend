/**
 * Script de migración de base de datos para el ciclo de vida de productos (Product Status Lifecycle)
 * Multi-Tenant Aware:
 * 1. Conecta a MongoDB.
 * 2. Lee todos los tenants desde 'master_db' y además lista todas las bases de datos del cluster.
 * 3. Para cada base de datos de tenant, migra la colección 'products':
 *    - isActive: true / sin status -> status: 'published'
 *    - isActive: false -> status: 'archived'
 *    - Elimina (unset) el campo 'isActive' obsoleto.
 *
 * Uso:
 *   node src/scripts/migrate_product_statuses.cjs
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function runMigration() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ Error: No se encontró MONGODB_URI ni MONGO_URI en el archivo .env');
    process.exit(1);
  }

  console.log('🔄 Conectando a MongoDB Cluster...');
  const baseConn = await mongoose.createConnection(uri).asPromise();
  console.log('✅ Conexión base establecida.');

  // Obtener lista de bases de datos desde master_db o cluster
  const tenantDbs = new Set();

  try {
    const masterDb = baseConn.useDb('master_db', { useCache: true });
    const TenantModel = masterDb.model('Tenant', new mongoose.Schema({
      name: String,
      slug: String,
      dbName: String
    }, { strict: false }));

    const tenants = await TenantModel.find({});
    console.log(`🏢 Tenants registrados en master_db: ${tenants.length}`);
    for (const t of tenants) {
      if (t.dbName) {
        tenantDbs.add(t.dbName);
        console.log(`   - Tenant: ${t.name || t.slug} -> DB: ${t.dbName}`);
      }
    }
  } catch (err) {
    console.warn('⚠️ No se pudo consultar master_db directamente:', err.message);
  }

  // También listar todas las DBs del cluster
  try {
    const adminDb = baseConn.db.admin();
    const dbsList = await adminDb.listDatabases();
    for (const d of dbsList.databases) {
      if (!['admin', 'local', 'config', 'master_db'].includes(d.name)) {
        tenantDbs.add(d.name);
      }
    }
  } catch (err) {
    console.warn('⚠️ No se pudo ejecutar listDatabases en admin:', err.message);
  }

  // Asegurar que si la URI apunta a una DB específica, también se incluya
  const parsedDbName = baseConn.name;
  if (parsedDbName && !['admin', 'local', 'config', 'master_db'].includes(parsedDbName)) {
    tenantDbs.add(parsedDbName);
  }

  console.log(`\n📦 Bases de datos a procesar: [${Array.from(tenantDbs).join(', ')}]`);

  for (const dbName of tenantDbs) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`🔍 Procesando base de datos: '${dbName}'`);
    const targetDb = baseConn.useDb(dbName, { useCache: true });
    const col = targetDb.collection('products');

    const totalProducts = await col.countDocuments({});
    console.log(`   Total productos en '${dbName}.products': ${totalProducts}`);

    if (totalProducts === 0) {
      console.log(`   (Sin productos en esta DB, omitiendo...)`);
      continue;
    }

    // 1. Contar productos que tienen isActive: true o no tienen status
    const toPublish = await col.countDocuments({
      $or: [
        { isActive: true },
        { status: { $exists: false }, isActive: { $ne: false } },
        { status: null }
      ]
    });

    // 2. Contar productos que tienen isActive: false
    const toArchive = await col.countDocuments({
      isActive: false
    });

    console.log(`   - Productos a marcar como 'published': ${toPublish}`);
    console.log(`   - Productos a marcar como 'archived': ${toArchive}`);

    // Aplicar migración para activos
    const resPublish = await col.updateMany(
      {
        $or: [
          { isActive: true },
          { status: { $exists: false }, isActive: { $ne: false } },
          { status: null }
        ]
      },
      {
        $set: { status: 'published' },
        $unset: { isActive: '' }
      }
    );

    // Aplicar migración para inactivos
    const resArchive = await col.updateMany(
      {
        isActive: false
      },
      {
        $set: { status: 'archived' },
        $unset: { isActive: '' }
      }
    );

    // Limpiar cualquier residuo de isActive en documentos
    const resCleanup = await col.updateMany(
      { isActive: { $exists: true } },
      { $unset: { isActive: '' } }
    );

    console.log(`   ✅ Actualizados a 'published': ${resPublish.modifiedCount}`);
    console.log(`   ✅ Actualizados a 'archived': ${resArchive.modifiedCount}`);
    console.log(`   ✅ Limpieza isActive remanente: ${resCleanup.modifiedCount}`);

    // Mostrar un resumen del nuevo estado en la DB
    const publishedCount = await col.countDocuments({ status: 'published' });
    const draftCount = await col.countDocuments({ status: 'draft' });
    const pausedCount = await col.countDocuments({ status: 'paused' });
    const archivedCount = await col.countDocuments({ status: 'archived' });
    console.log(`   📈 Conteo final en '${dbName}':`);
    console.log(`      - 🟢 Published: ${publishedCount}`);
    console.log(`      - 🟡 Draft: ${draftCount}`);
    console.log(`      - ⏸️ Paused: ${pausedCount}`);
    console.log(`      - ⚪ Archived: ${archivedCount}`);
  }

  console.log('\n============================================================');
  console.log('🎉 ¡Migración de estados de productos completada con éxito en todos los tenants!');
  await baseConn.close();
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Error durante la migración:', err);
  process.exit(1);
});
