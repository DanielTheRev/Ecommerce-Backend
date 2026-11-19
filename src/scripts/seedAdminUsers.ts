import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { Role } from '@/interfaces/user.interface';
import { User } from '@/models/User.model';

dotenv.config({
	path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`)
});

const poblateAdminUsers = async () => {
	const mongoURI = process.env.MONGODB_URI;
	const adminEmail = process.env.SEED_ADMIN_EMAIL;
	const adminPassword = process.env.SEED_ADMIN_PASSWORD;
	const adminName = process.env.SEED_ADMIN_NAME || 'Admin';

	if (!mongoURI) {
		throw new Error('MONGODB_URI no está definida en las variables de entorno.');
	}
	if (!adminEmail || !adminPassword) {
		throw new Error('SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios.');
	}

	try {
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		const user = await User.findOne({ email: adminEmail }).select('+password');
		if (user) {
			user.password = adminPassword;
			user.role = Role.admin;
			await user.save();
		} else {
			const newUser = new User({
				name: adminName,
				email: adminEmail,
				password: adminPassword,
				role: Role.admin
			});
			await newUser.save();
		}

		console.log('\n📦 Usuarios creados:');
		const createdAdminUsers = await User.find({ role: Role.admin });
		createdAdminUsers.forEach((createdUser, index) => {
			console.log(`${index + 1}. ${createdUser.name}; ${createdUser.email}; ${createdUser.role}`);
		});

		console.log('\n🎉 ¡Base de datos poblada exitosamente!');
	} catch (error) {
		console.error('❌ Error al poblar la base de datos:', error);
		process.exitCode = 1;
	} finally {
		await mongoose.connection.close();
		console.log('🔒 Conexión cerrada');
		process.exit();
	}
};

if (require.main === module) {
	poblateAdminUsers();
}
