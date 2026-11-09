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
import crypto from 'crypto';
import slugify from 'slugify';
import { connectionManager } from '../config/multitenancy';
import { getModelsForConnection } from '../config/modelRegistry';
import { ITenant, TenantBusinessType, TenantPlan } from '../interfaces/tenant.interface';
import { Role } from '../interfaces/user.interface';
import { BUSINESS_VERTICAL_OPTIONS } from '../config/planCapabilities';

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

interface SelectOption<T> {
	label: string;
	value: T;
	desc?: string;
}

async function select<T>(question: string, options: SelectOption<T>[], defaultIndex = 0): Promise<T> {
	console.log(`\n${question}`);
	options.forEach((opt, idx) => {
		const isDefault = idx === defaultIndex ? ' (Default)' : '';
		console.log(`   [${idx + 1}] ${opt.label}${isDefault}`);
		if (opt.desc) {
			console.log(`       └─ ${opt.desc}`);
		}
	});

	while (true) {
		const answer = await ask(`👉 Elegí una opción [1-${options.length}]`, String(defaultIndex + 1));
		const num = parseInt(answer, 10);
		if (!isNaN(num) && num >= 1 && num <= options.length) {
			return options[num - 1].value;
		}
		console.log(`⚠️ Opción inválida. Ingresá un número del 1 al ${options.length}.`);
	}
}

function generateDbName(slug: string): string {
	return `${slug.replace(/-/g, '_')}_db`;
}

// ────────────────────────────── Main ──────────────────────────────

async function createTenant() {
	console.log('\n🏢 ═══════════════════════════════════════════════════════════════');
	console.log('   VEXX — Asistente Interactivo de Alta de Comercio (Onboarding)');
	console.log('═════════════════════════════════════════════════════════════════\n');

	try {
		// 1️⃣ Recolectar datos del tenant
		const name = await ask('📛 Nombre del negocio (ej: Kiosco Central)');
		if (!name) { console.log('❌ El nombre es requerido'); process.exit(1); }

		const slugSuggestion = slugify(name, { lower: true, strict: true });
		const slug = await ask('🔗 Slug identificador único para login y URLs', slugSuggestion);

		// 2️⃣ Selección interactiva de rubro (sin strings mágicos)
		const businessType = await select<TenantBusinessType>(
			'🛍️  Seleccioná el Rubro Comercial del negocio:',
			BUSINESS_VERTICAL_OPTIONS.map((v) => ({
				label: `${v.label} — [${v.badge}]`,
				value: v.code,
				desc: v.description
			})),
			0 // Por defecto: Kiosco / Maxikiosco / Almacén
		);

		// 3️⃣ Selección interactiva del Plan de Vexx
		const plan = await select<TenantPlan>(
			'📦 Seleccioná el Plan Comercial de Vexx:',
			[
				{
					label: 'Plan Básico — Solo Mostrador / POS de Barrio',
					value: TenantPlan.basic,
					desc: 'Terminal de cobro rápido, control de stock y arqueo de caja registradora'
				},
				{
					label: 'Plan Premium — Mostrador + Tienda Online + Facturación AFIP',
					value: TenantPlan.premium,
					desc: 'POS + eCommerce web completo + Pasarelas de pago + Facturación electrónica ARCA'
				}
			],
			0 // Por defecto: Básico
		);

		const domain = await ask('🌐 Dominio propio (opcional, ej: micomercios.com.ar)', '');
		const logo = await ask('🖼️  Logo URL (opcional)', '');
		const primaryColor = await ask('🎨 Color primario hex', '#059669');

		const commissionStr = await ask('💰 Comisión % de Vexx por venta (0 si es negocio propio o abono fijo)', '0');
		const commission = parseFloat(commissionStr) || 0;

		// 4️⃣ Datos del usuario admin
		console.log('\n👤 Datos del Administrador / Dueño del negocio:');
		const adminName = await ask('   Nombre completo del dueño', name);
		const adminEmail = await ask('   Email de acceso al Panel');
		if (!adminEmail) { console.log('❌ El email es requerido'); process.exit(1); }

		const adminPassword = await ask('   Contraseña de acceso (mín 6 chars)', 'Admin2026!');
		if (!adminPassword || adminPassword.length < 6) {
			console.log('❌ La contraseña debe tener al menos 6 caracteres');
			process.exit(1);
		}

		// Allowed origins
		const originsInput = await ask(
			'🔒 Origins web permitidos',
			domain ? `https://${domain},https://www.${domain}` : 'https://panel.vexx.com.ar,http://localhost:4200'
		);
		const allowedOrigins = originsInput.split(',').map(o => o.trim());

		const dbName = generateDbName(slug);
		const apiKey = `pk_live_${crypto.randomBytes(16).toString('hex')}`;

		// 5️⃣ Resumen y Confirmación
		console.log('\n📋 Resumen del Comercio a Crear:');
		console.log('─────────────────────────────────────────────────────────────');
		console.log(`   Negocio:        ${name}`);
		console.log(`   Slug:           ${slug}`);
		console.log(`   Rubro:          ${businessType}`);
		console.log(`   Plan Vexx:      ${plan.toUpperCase()}`);
		console.log(`   Comisión Vexx:  ${commission}%`);
		console.log(`   Base de Datos:  ${dbName}`);
		console.log(`   Storefront Key: ${apiKey}`);
		console.log(`   Dominio:        ${domain || '(sin dominio propio)'}`);
		console.log(`   Admin Email:    ${adminEmail}`);
		console.log(`   Contraseña:     ${adminPassword}`);
		console.log(`   Origins:        ${allowedOrigins.join(', ')}`);
		console.log('─────────────────────────────────────────────────────────────');

		const confirm = await ask('\n✅ ¿Aprovisionar comercio y base de datos ahora? (s/n)', 's');
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
			businessType,
			apiKey,
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

		// 7️⃣ Seed de config base del ecommerce
		const existingConfig = await models.EcommerceConfig.findOne({ key: 'global_config' });
		if (!existingConfig) {
			await models.EcommerceConfig.create({
				key: 'global_config',
				name: name,
				businessType: businessType
			});
			console.log('✅ Configuración base del ecommerce creada');
		}

		console.log('\n🏁 ¡Onboarding completado exitosamente!');
		console.log('\n📌 Instrucciones de acceso para el nuevo comercio:');
		console.log(`   1. Panel de Control Web: https://panel.vexx.com.ar`);
		console.log(`   2. En la pantalla de Login ingresar:`);
		console.log(`      • Comercio (Slug):  ${slug}`);
		console.log(`      • Email:            ${adminEmail}`);
		console.log(`      • Contraseña:       ${adminPassword}`);
		console.log(`   3. Link directo pre-cargado: https://panel.vexx.com.ar/login?store=${slug}`);
		console.log(`   4. Storefront API Key pública: ${apiKey}`);

	} catch (error) {
		console.error('\n❌ Error:', error);
	} finally {
		rl.close();
		await connectionManager.disconnect();
		process.exit(0);
	}
}

createTenant();
