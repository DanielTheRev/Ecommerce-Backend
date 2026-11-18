import dotenv from 'dotenv';
import readline from 'readline';
import { connectionManager } from '@/config/multitenancy';
import { IMasterOperator, MasterOperatorSchema } from '@/models/MasterOperator.model';
import { EmailSecurityUtil } from '@/utils/emailSecurity.util';

const envFile = process.env.NODE_ENV === 'production' ? '.env' : '.env.development';
dotenv.config({ path: envFile });

const ask = (rl: readline.Interface, q: string): Promise<string> =>
	new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

async function main() {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	try {
		const argName = process.argv[2];
		const argEmail = process.argv[3];
		const argPassword = process.argv[4];

		const name = argName || (await ask(rl, 'Nombre completo del SuperAdmin: '));
		const rawEmail = argEmail || (await ask(rl, 'Email del SuperAdmin: '));
		const password = argPassword || (await ask(rl, 'Contraseña (mín. 8 caracteres): '));

		if (!name || password.length < 8) {
			throw new Error('El nombre es obligatorio y la contraseña debe tener al menos 8 caracteres.');
		}
		const email = EmailSecurityUtil.normalizeAndValidateEmail(rawEmail);

		await connectionManager.connect();
		const masterDb = connectionManager.getMasterDb();
		if (!masterDb.models.MasterOperator) {
			masterDb.model<IMasterOperator>('MasterOperator', MasterOperatorSchema);
		}
		const MasterOperatorModel = masterDb.model<IMasterOperator>('MasterOperator');

		let operator = await MasterOperatorModel.findOne({ email });
		if (operator) {
			operator.name = name;
			operator.password = password;
			operator.role = 'superadmin';
			operator.isActive = true;
			operator.permissions = ['*'];
			operator.tokenVersion = (operator.tokenVersion || 0) + 1;
			await operator.save();
			console.log(`✅ SuperAdmin actualizado exitosamente: ${email}`);
		} else {
			operator = await MasterOperatorModel.create({
				name,
				email,
				password,
				role: 'superadmin',
				permissions: ['*'],
				isActive: true,
				tokenVersion: 0
			});
			console.log(`✅ SuperAdmin creado exitosamente en master_db.master_operators: ${email}`);
		}
	} finally {
		rl.close();
		await connectionManager.disconnect();
	}
}

main().catch((err) => {
	console.error('❌ Error creando SuperAdmin:', err.message || err);
	process.exit(1);
});
