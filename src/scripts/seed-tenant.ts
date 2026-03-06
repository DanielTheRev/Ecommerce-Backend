/**
 * Script de migración: Seed del tenant "electromix" en master_db
 *
 * Ejecutar con: npx ts-node -r tsconfig-paths/register src/scripts/seed-tenant.ts
 *
 * Este script:
 * 1. Conecta a MongoDB
 * 2. Crea el tenant "electromix" en master_db si no existe
 * 3. Verifica que la DB del tenant exista y tenga datos
 */
import dotenv from 'dotenv';
dotenv.config();

import { connectionManager } from '../config/multitenancy';
import { ITenant, TenantPlan } from '../interfaces/tenant.interface';

const ELECTROMIX_TENANT = {
	slug: 'electromix',
	name: 'ElectroMix - Tienda de Tecnología',
	dbName: 'electromix_db', // Nombre de la DB actual o nueva
	domain: 'electromix.com.ar',
	isActive: true,
	plan: TenantPlan.premium,
	commission: {
		percentage: 0,  // Es tu propia tienda, sin comisión
		fixedFee: 0
	},
	settings: {
		logo: '',
		primaryColor: '#3B82F6',
		allowedOrigins: [
			'https://www.electromix.com.ar',
			'https://electromix.com.ar',
			'http://localhost:4200',
			'http://localhost:5173'
		]
	}
};

async function seedTenant() {
	try {
		console.log('🔌 Conectando a MongoDB...');
		await connectionManager.connect();

		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		// Check if tenant already exists
		const existing = await TenantModel.findOne({ slug: ELECTROMIX_TENANT.slug });

		if (existing) {
			console.log(`✅ Tenant "${ELECTROMIX_TENANT.slug}" ya existe:`);
			console.log(`   ID: ${existing._id}`);
			console.log(`   DB: ${existing.dbName}`);
			console.log(`   Plan: ${existing.plan}`);
			console.log(`   Activo: ${existing.isActive}`);
		} else {
			const tenant = await TenantModel.create(ELECTROMIX_TENANT);
			console.log(`✅ Tenant "${ELECTROMIX_TENANT.slug}" creado exitosamente!`);
			console.log(`   ID: ${tenant._id}`);
			console.log(`   DB: ${tenant.dbName}`);
			console.log(`   Plan: ${tenant.plan}`);
		}

		// Verify the tenant DB exists and show its collections
		const tenantDb = connectionManager.getTenantDb(ELECTROMIX_TENANT.dbName);
		if (tenantDb.db) {
			const collections = await tenantDb.db.listCollections().toArray();
			console.log(`\n📊 Colecciones en ${ELECTROMIX_TENANT.dbName}:`);
			if (collections.length === 0) {
				console.log('   (vacío — se crearán automáticamente cuando se use la API)');
			} else {
				collections.forEach(col => {
					console.log(`   📁 ${col.name}`);
				});
			}
		} else {
			console.log('\n📊 No se pudo acceder a la DB del tenant (se creará al primer uso)');
		}

		console.log('\n🏁 Migración completada!');
		console.log('\n💡 Nota: Si ya tenés datos en otra DB, necesitás copiarlos a', ELECTROMIX_TENANT.dbName);
		console.log('   Podés usar: mongodump --db=<db_actual> && mongorestore --db=electromix_db dump/<db_actual>');

	} catch (error) {
		console.error('❌ Error en la migración:', error);
	} finally {
		await connectionManager.disconnect();
		process.exit(0);
	}
}

seedTenant();
