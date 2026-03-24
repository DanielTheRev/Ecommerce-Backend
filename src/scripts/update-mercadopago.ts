/**
 * 🛠️ Script interactivo para actualizar credenciales de MercadoPago de un Tenant
 *
 * Ejecutar con:
 *   npx ts-node -r tsconfig-paths/register src/scripts/update-mercadopago.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import { connectionManager } from '../config/multitenancy';
import { getModelsForConnection } from '../config/modelRegistry';
import { ITenant } from '../interfaces/tenant.interface';

// ────────────────────────────── Helpers ──────────────────────────────

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function ask(question: string, defaultValue?: string): Promise<string> {
	const suffix = defaultValue ? ` (${defaultValue})` : '';
	return new Promise((resolve) => {
		rl.question(`${question}${suffix}: `, (answer) => {
			resolve(answer.trim() || defaultValue || '');
		});
	});
}

// ────────────────────────────── Main ──────────────────────────────

async function updateMercadoPago() {
	console.log('\n💳 ════════════════════════════════════════════════════');
	console.log('   Actualizar Credenciales de MercadoPago (Testing)');
	console.log('═══════════════════════════════════════════════════════\n');

	try {
		const slug = await ask('🔗 Slug del Tenant (identificador del negocio/usuario)');
		if (!slug) { 
			console.log('❌ El slug es requerido'); 
			process.exit(1); 
		}

		const accessToken = await ask('🔑 Nuevo Access Token (Ej: TEST-...)');
		if (!accessToken) { 
			console.log('❌ El Access Token es requerido'); 
			process.exit(1); 
		}

		const publicKey = await ask('📢 Nuevo Public Key (Ej: TEST-...)');
		if (!publicKey) { 
			console.log('❌ El Public Key es requerido'); 
			process.exit(1); 
		}

		console.log('\n🔌 Conectando a MongoDB...');
		await connectionManager.connect();

		// Buscar el tenant en la master_db
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const tenant = await TenantModel.findOne({ slug });
		if (!tenant) {
			console.log(`❌ No se encontró ningún tenant con slug "${slug}"`);
			process.exit(1);
		}

		console.log(`✅ Tenant encontrado: ${tenant.name} (DB: ${tenant.dbName})`);

		// Conectar a la DB del tenant
		const tenantDb = connectionManager.getTenantDb(tenant.dbName);
		const models = getModelsForConnection(tenantDb);

		// Buscar la configuración del ecommerce del tenant
		const config = await models.EcommerceConfig.findOne({ key: 'global_config' });
		if (!config) {
			console.log(`❌ No se encontró la configuración (global_config) para el tenant ${slug}`);
			process.exit(1);
		}

		// Importar dinámicamente o requerir la utilidad de encriptación por las dudas
		const { encrypt } = require('../utils/encryption');

		// Actualizar credenciales encriptadas y asegurar que esté activo
		config.paymentGateways.mercadopago.accessToken = JSON.stringify(encrypt(accessToken));
		config.paymentGateways.mercadopago.publicKey = JSON.stringify(encrypt(publicKey));
		config.paymentGateways.mercadopago.active = true;
		
		await config.save();
		console.log('\n✅ ¡Credenciales de MercadoPago actualizadas correctamente!');

	} catch (error) {
		console.error('\n❌ Error al actualizar credenciales:', error);
	} finally {
		rl.close();
		await connectionManager.disconnect();
		process.exit(0);
	}
}

updateMercadoPago();
