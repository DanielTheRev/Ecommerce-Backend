import mongoose from 'mongoose';
import { PaymentMethod } from '../models/PaymentMethod.model';
import { PaymentType } from '../interfaces/paymentMethod.interface';
import dotenv from 'dotenv';
dotenv.config();

const initPaymentMethods = async () => {
	try {
		// Conectar a la base de datos
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vura_store_db';
		await mongoose.connect(mongoURI);

		// Verificar si ya existen métodos de pago
		const existingPaymentMethods = await PaymentMethod.countDocuments();
		
		if (existingPaymentMethods > 0) {
			console.log('✅ Ya existen métodos de pago en la base de datos');
			return;
		}

		// Crear los métodos de pago por defecto
		const defaultPaymentMethods = [
			{
				type: PaymentType.CASH,
				name: 'Efectivo',
				description: 'Pago en efectivo en punto de encuentro',
				isActive: true,
				processingFee: 0
			},
			{
				type: PaymentType.BANK_TRANSFER,
				name: 'Transferencia bancaria',
				description: 'Transferencia bancaria tradicional',
				isActive: true,
				processingFee: 0
			},
			{
				type: PaymentType.ALIAS_TRANSFER,
				name: 'Transferencia a alias',
				description: 'Transferencia mediante alias bancario o CVU',
				isActive: true,
				processingFee: 0
			},
			{
				type: PaymentType.CARD,
				name: 'Tarjeta de crédito/débito',
				description: 'Pago con tarjeta de crédito o débito',
				isActive: true,
				processingFee: 3.5 // 3.5% de comisión por ejemplo
			}
		];

		// Insertar los métodos de pago
		await PaymentMethod.insertMany(defaultPaymentMethods);

		console.log('✅ Métodos de pago inicializados correctamente:');
		defaultPaymentMethods.forEach(method => {
			console.log(`   - ${method.name} (${method.type})`);
		});

	} catch (error) {
		console.error('❌ Error al inicializar los métodos de pago:', error);
	} finally {
		// Cerrar la conexión
		await mongoose.connection.close();
		console.log('🔚 Conexión cerrada');
	}
};

// Ejecutar el script si se llama directamente
if (require.main === module) {
	initPaymentMethods();
}

export { initPaymentMethods };
