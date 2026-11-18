import assert from 'assert';
import jwt from 'jsonwebtoken';
import { EmailSecurityUtil } from '@/utils/emailSecurity.util';
import { buildPermissionCatalogForAddons } from '@/config/permissionCatalog';
import { MasterAuthService, MASTER_TOKEN_AUDIENCE } from '@/services/auth/masterAuth.service';
import { PanelAuthService, PANEL_TOKEN_AUDIENCE } from '@/services/auth/panelAuth.service';
import { StorefrontAuthService, STOREFRONT_TOKEN_AUDIENCE } from '@/services/auth/storefrontAuth.service';
import { Role } from '@/interfaces/user.interface';
import { AppError } from '@/errors/app.error';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_vexx_2026';

async function runTests() {
	console.log('🧪 Iniciando pruebas de Rework de Autenticación, Seguridad y Permisos...\n');

	// 1. EmailSecurityUtil: normalización y bloqueo de homógrafos / acentos
	assert.strictEqual(
		EmailSecurityUtil.normalizeAndValidateEmail('  Daniel.Larrosa@VURA.com.ar  '),
		'daniel.larrosa@vura.com.ar'
	);
	assert.throws(
		() => EmailSecurityUtil.normalizeAndValidateEmail('admin@vúra.com.ar'),
		(err: any) => err instanceof AppError && err.statusCode === 400,
		'Debe rechazar dominios con tildes / caracteres no-ASCII (ataque homógrafo)'
	);
	assert.throws(
		() => EmailSecurityUtil.normalizeAndValidateEmail('admin@xn--vra-1na.com.ar'),
		(err: any) => err instanceof AppError && err.statusCode === 400,
		'Debe rechazar dominios Punycode sospechosos'
	);
	assert.throws(
		() => EmailSecurityUtil.normalizeAndValidateEmail('maría@gmail.com'),
		(err: any) => err instanceof AppError && err.statusCode === 400,
		'Debe rechazar tildes en el email en flujos de autenticación estricta'
	);
	console.log('✅ 1. EmailSecurityUtil bloquea dominios homógrafos y tildes ambiguas.');

	// 2. Generación y verificación de tokens con audience y tokenVersion aislados
	const masterToken = MasterAuthService.generateMasterToken({
		_id: 'op_1',
		email: 'daniel@vexx.com.ar',
		role: 'superadmin',
		tokenVersion: 2
	});
	const masterDecoded = jwt.verify(masterToken, process.env.JWT_SECRET!, {
		audience: MASTER_TOKEN_AUDIENCE
	}) as any;
	assert.strictEqual(masterDecoded.aud, MASTER_TOKEN_AUDIENCE);
	assert.strictEqual(masterDecoded.tokenVersion, 2);

	const panelToken = PanelAuthService.generatePanelToken(
		{ _id: 'adm_1', role: Role.admin, tokenVersion: 1 },
		'vura',
		false
	);
	assert.throws(
		() => jwt.verify(panelToken, process.env.JWT_SECRET!, { audience: MASTER_TOKEN_AUDIENCE }),
		/jwt audience invalid/,
		'Un token del panel de comercio NO debe pasar validación de Master Console'
	);
	assert.throws(
		() => jwt.verify(panelToken, process.env.JWT_SECRET!, { audience: STOREFRONT_TOKEN_AUDIENCE }),
		/jwt audience invalid/,
		'Un token del panel de comercio NO debe pasar validación de Storefront'
	);

	const storefrontToken = StorefrontAuthService.generateStorefrontToken(
		{ _id: 'usr_1', role: Role.user, tokenVersion: 0 },
		'vura'
	);
	assert.throws(
		() => jwt.verify(storefrontToken, process.env.JWT_SECRET!, { audience: PANEL_TOKEN_AUDIENCE }),
		/jwt audience invalid/,
		'Un token de comprador público NO debe pasar validación de Panel Admin'
	);
	console.log('✅ 2. Aislamiento estricto de audiences JWT (vexx_master, vexx_panel, vexx_storefront) verificado.');

	// 3. Reset Token hashing y un solo uso
	const { rawToken, tokenHash, expiresAt } = EmailSecurityUtil.generateResetToken(15);
	assert.strictEqual(rawToken.length, 64);
	assert.strictEqual(EmailSecurityUtil.hashToken(rawToken), tokenHash);
	assert(expiresAt.getTime() > Date.now(), 'El token de recuperación debe tener fecha futura');
	console.log('✅ 3. Generación y hash SHA-256 de tokens de recuperación verificados.');

	// 4. PermissionCatalog dinámico por Addons activos
	const localKioskCatalog = buildPermissionCatalogForAddons([
		'store_management',
		'pos',
		'cash_register',
		'sales_control'
	]);
	const localKeys = localKioskCatalog.flatMap((s) => s.permissions.map((p) => p.key));
	assert(localKeys.includes('pos:access'), 'Kiosco Local con POS debe incluir pos:access');
	assert(localKeys.includes('cash:open_close'), 'Kiosco Local con Caja debe incluir cash:open_close');
	assert(localKeys.includes('sales:view'), 'Kiosco Local con sales_control debe incluir sales:view');
	assert(!localKeys.includes('orders:manage'), 'Kiosco Local SIN online_orders NO debe ver orders:manage');
	assert(!localKeys.includes('analytics:daily_summary'), 'Sin daily_summary NO debe ver analytics:daily_summary');

	const proCatalog = buildPermissionCatalogForAddons([
		'store_management',
		'pos',
		'online_orders',
		'daily_summary',
		'coupons',
		'fiscal_audit'
	]);
	const proKeys = proCatalog.flatMap((s) => s.permissions.map((p) => p.key));
	assert(proKeys.includes('orders:manage'), 'Comercio con online_orders debe ver orders:manage');
	assert(proKeys.includes('analytics:daily_summary'), 'Comercio con daily_summary debe ver analytics:daily_summary');
	assert(proKeys.includes('marketing:manage'), 'Comercio con coupons debe ver marketing:manage');
	assert(proKeys.includes('fiscal:manage'), 'Comercio con fiscal_audit debe ver fiscal:manage');
	console.log('✅ 4. Matriz dinámica de permisos (bootstrap.permissionCatalog) filtrada por addons verificada.\n');

	console.log('🎉 TODAS LAS PRUEBAS DEL REWORK DE AUTENTICACIÓN Y PERMISOS PASARON EXITOSAMENTE.');
}

runTests().catch((err) => {
	console.error('❌ Falló la suite de pruebas:', err);
	process.exit(1);
});
