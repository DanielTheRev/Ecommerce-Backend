import { Role } from '@/interfaces/user.interface';
import { User } from '@/models/User.model';
import { UserService } from '@/services/user.service';
import mongoose from 'mongoose';

const adminUsers = [
	{
		name: 'Daniel Larrosa',
		email: 'fernando.larrosa94@gmail.com',
		password: '@Unarefacil1'
	}
];

const poblateAdminUsers = async () => {
	try {
		// Conectar a MongoDB
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		// Limpiar la colección existente
		// await User.deleteMany({ role: 'admin' });
		// console.log('🗑️ Productos existentes eliminados');

		// Insertar productos de prueba
		for (const AdminUser of adminUsers) {
			const user = await User.findOne({ email: AdminUser.email }).select('+password');
			if (user) {
				user.password = AdminUser.password;
				user.role = Role.admin;
				await user.save();
				continue;
			}
			const newUser = new User(AdminUser);
			await newUser.save();
		}

		// Mostrar algunos usuarios creados
		console.log('\n📦 Usuarios creados:');
		const createdAdminUsers = await User.find({ role: Role.admin });
		createdAdminUsers.forEach((user, index) => {
			console.log(`${index + 1}. ${user.name}; ${user.email}; ${user.role}`);
		});

		console.log('\n🎉 ¡Base de datos poblada exitosamente!');
	} catch (error) {
		console.error('❌ Error al poblar la base de datos:', error);
	} finally {
		await mongoose.connection.close();
		console.log('🔒 Conexión cerrada');
		process.exit(0);
	}
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
	poblateAdminUsers();
}
