import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

function generateLink() {
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		console.error('❌ Error: JWT_SECRET no está definido en el archivo .env');
		process.exit(1);
	}

	// Obtener tenant de los argumentos CLI o default a 'vura'
	const args = process.argv.slice(2);
	const tenantArg = args.find(a => a.startsWith('--tenant='));
	const domainArg = args.find(a => a.startsWith('--domain='));

	const tenantSlug = tenantArg ? tenantArg.split('=')[1] : 'vura';
	const domain = domainArg ? domainArg.split('=')[1] : (process.env.PUBLIC_DOMAIN || 'https://vura.com.ar');
	const localDomain = 'http://localhost:4000';

	// Payload del token que expira en 5 minutos
	const payload = {
		purpose: 'public_export',
		tenantSlug,
	};

	const token = jwt.sign(payload, secret, { expiresIn: '5m' });

	const expDate = new Date(Date.now() + 5 * 60 * 1000);
	const formattedExp = expDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

	const prodUrl = `${domain}/api/products/public-export/${tenantSlug}?token=${token}`;
	const localUrl = `${localDomain}/api/products/public-export/${tenantSlug}?token=${token}`;

	console.log('\n====================================================');
	console.log('🔑 ENLACE PÚBLICO TEMPORAL DE PRODUCTOS ACTIVOS 🔑');
	console.log('====================================================');
	console.log(`🏢 Tenant: ${tenantSlug}`);
	console.log(`⏱️  Validez: 5 Minutos (Expira a las ${formattedExp})`);
	console.log('\n🌐 URL Producción:');
	console.log(`\x1b[36m${prodUrl}\x1b[0m`);
	console.log('\n💻 URL Desarrollo (Localhost):');
	console.log(`\x1b[32m${localUrl}\x1b[0m`);
	console.log('====================================================\n');
}

generateLink();
