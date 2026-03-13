/**
 * 🏢 Script de Onboarding — Crear un tenant + usuario admin
 *
 * Ejecutar con:
 *   npx ts-node -r tsconfig-paths/register src/scripts/create-tenant.ts
 *
 * Ejemplo interactivo:
 *   ¿Nombre del negocio? → Cafetería Premium
 *   ¿Slug? → cafeteria-premium
 *   ¿Dominio? → cafeteriapremium.com.ar
 *   ¿Logo URL? → https://...
 *   ¿Email del admin? → admin@cafeteriapremium.com
 *   ¿Contraseña temporal? → Temp1234!
 */
import dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import slugify from 'slugify';
import { connectionManager } from '../config/multitenancy';
import { getModelsForConnection } from '../config/modelRegistry';
import { ITenant, TenantPlan } from '../interfaces/tenant.interface';
import { Role } from '../interfaces/user.interface';

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

function generateDbName(slug: string): string {
	return `${slug.replace(/-/g, '_')}_db`;
}

// ────────────────────────────── Main ──────────────────────────────

async function createTenant() {
	console.log('\n🏢 ═══════════════════════════════════════');
	console.log('   Crear nuevo Tenant + Admin');
	console.log('═══════════════════════════════════════════\n');

	try {
		// 1️⃣ Recolectar datos del tenant
		const name = await ask('📛 Nombre del negocio');
		if (!name) { console.log('❌ El nombre es requerido'); process.exit(1); }

		const slugSuggestion = slugify(name, { lower: true, strict: true });
		const slug = await ask('🔗 Slug (identificador único)', slugSuggestion);

		const domain = await ask('🌐 Dominio (opcional)', '');
		const logo = await ask('🖼️  Logo URL (opcional)', '');
		const primaryColor = await ask('🎨 Color primario', '#3B82F6');

		const planInput = await ask('📦 Plan (basic/premium)', 'basic');
		const plan = planInput === 'premium' ? TenantPlan.premium : TenantPlan.basic;

		const commissionStr = await ask('💰 Comisión % (0 si es tu tienda)', '10');
		const commission = parseFloat(commissionStr) || 0;

		// 2️⃣ Datos del usuario admin
		console.log('\n👤 Datos del administrador del negocio:');
		const adminName = await ask('   Nombre del admin', name);
		const adminEmail = await ask('   Email del admin');
		if (!adminEmail) { console.log('❌ El email es requerido'); process.exit(1); }

		const adminPassword = await ask('   Contraseña temporal (mín 6 chars)');
		if (!adminPassword || adminPassword.length < 6) {
			console.log('❌ La contraseña debe tener al menos 6 caracteres');
			process.exit(1);
		}

		// Allowed origins
		const originsInput = await ask(
			'🔒 Origins permitidos (separados por coma)',
			domain ? `https://${domain},https://www.${domain}` : 'http://localhost:4200'
		);
		const allowedOrigins = originsInput.split(',').map(o => o.trim());

		const dbName = generateDbName(slug);

		// 3️⃣ Confirmar
		console.log('\n📋 Resumen:');
		console.log('─────────────────────────────');
		console.log(`   Negocio:    ${name}`);
		console.log(`   Slug:       ${slug}`);
		console.log(`   DB:         ${dbName}`);
		console.log(`   Dominio:    ${domain || '(sin dominio)'}`);
		console.log(`   Plan:       ${plan}`);
		console.log(`   Comisión:   ${commission}%`);
		console.log(`   Admin:      ${adminEmail}`);
		console.log(`   Origins:    ${allowedOrigins.join(', ')}`);
		console.log('─────────────────────────────');

		const confirm = await ask('\n✅ ¿Crear? (s/n)', 's');
		if (confirm.toLowerCase() !== 's') {
			console.log('🚫 Cancelado');
			process.exit(0);
		}

		// 4️⃣ Conectar a MongoDB
		console.log('\n🔌 Conectando a MongoDB...');
		await connectionManager.connect();

		// 5️⃣ Crear tenant en master_db
		const masterDb = connectionManager.getMasterDb();
		const TenantModel = masterDb.model<ITenant>('Tenant');

		const existingTenant = await TenantModel.findOne({ slug });
		if (existingTenant) {
			console.log(`❌ Ya existe un tenant con slug "${slug}"`);
			process.exit(1);
		}

		const tenant = await TenantModel.create({
			slug,
			name,
			dbName,
			domain: domain || undefined,
			isActive: true,
			plan,
			commission: {
				percentage: commission,
				fixedFee: 0
			},
			settings: {
				logo,
				primaryColor,
				allowedOrigins
			}
		});

		console.log(`✅ Tenant creado: ${tenant.slug} (${tenant._id})`);

		// 6️⃣ Crear usuario admin en la DB del tenant
		const tenantDb = connectionManager.getTenantDb(dbName);
		const models = getModelsForConnection(tenantDb);

		const existingUser = await models.User.findOne({ email: adminEmail });
		if (existingUser) {
			console.log(`⚠️  Ya existe un usuario con email "${adminEmail}" en esta DB`);
		} else {
			const adminUser = await models.User.create({
				name: adminName,
				email: adminEmail,
				password: adminPassword, // Se hashea automáticamente con el pre-save hook
				role: Role.admin,
				isActive: true
			});
			console.log(`✅ Admin creado: ${adminUser.email} (role: admin)`);
		}

		// 7️⃣ Seed de config base del ecommerce (opcional)
		const existingConfig = await models.EcommerceConfig.findOne({ key: 'global_config' });
		if (!existingConfig) {
			await models.EcommerceConfig.create({ key: 'global_config', name: name });
			console.log('✅ Configuración base del ecommerce creada');
		}

		console.log('\n🏁 ¡Onboarding completado!');
		console.log('\n📌 Instrucciones para el cliente:');
		console.log(`   1. Entrar a: ${domain ? `https://${domain}` : 'http://localhost:4200'}`);
		console.log(`   2. Email: ${adminEmail}`);
		console.log(`   3. Contraseña: (la que le diste)`);
		console.log(`   4. Desde el frontend, enviar header: x-tenant-id: ${slug}`);

	} catch (error) {
		console.error('\n❌ Error:', error);
	} finally {
		rl.close();
		await connectionManager.disconnect();
		process.exit(0);
	}
}

createTenant();
