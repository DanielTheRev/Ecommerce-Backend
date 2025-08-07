import mongoose from 'mongoose';
import { IAdminUserCreate } from '../models/AdminUser';
import { AdminUsers } from '../models/AdminUser';

const adminUsers: IAdminUserCreate[] = [
	// {
	// 	name: 'Daniel Larrosa',
	// 	email: 'larrosadaniel2894@gmail.com',
	// 	password: '@Unarefacil1'
	// }
];

const poblateAdminUsers = async () => {
	try {
		// Conectar a MongoDB
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		// Limpiar la colección existente
		await AdminUsers.deleteMany({});
		console.log('🗑️ Productos existentes eliminados');

		// Insertar productos de prueba
		for (const AdminUser of adminUsers) {
			const newUser = new AdminUsers(AdminUser);
			await newUser.save();
		}

		// Mostrar algunos usuarios creados
		console.log('\n📦 Usuarios creados:');
		const createdAdminUsers = await AdminUsers.find();
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
