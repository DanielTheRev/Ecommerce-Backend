import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ShippingOption, ShippingType } from '../models/ShippingOption.model';

// Cargar variables de entorno
dotenv.config();

const shippingOptions = [
	{
		type: ShippingType.PICKUP,
		name: 'Retiro en Punto de encuentro',
		cost: 0,
		isDefaultForCash: true,
		pickupPoints: [
			{
				name: 'Berazategui Centro (McDonalds)',
				address: ' Av. Presidente Perón, Av. 14 4985, Berazategui Centro'
			},
			{
				name: 'Quilmes Centro (McDonalds)',
				address: ' Peatonal Rivadavia 124, Quilmes Centro'
			}
		]
	},
	// {
	// 	type: ShippingType.HOME_DELIVERY,
	// 	name: 'Envío a Domicilio por Correo',
	// 	cost: 5000, // $5000 pesos
	// 	isDefaultForCash: false,
	// 	pickupPoints: [
	// 		{ name: 'Correo Argentino', address: '' },
	// 		{ name: 'Andreani', address: '' },
	// 		{ name: 'Envío en el día vía moto', address: '' }
	// 	]
	// }
	{
		type: ShippingType.HOME_DELIVERY,
		name: 'Envío a Domicilio por Correo',
		cost: 0, // $5000 pesos
		isDefaultForCash: false,
		pickupPoints: [
			{ name: 'Coordinar correo / Envío en el dia por moto', address: '' }

			// { name: 'Andreani', address: '' },
			// { name: 'Envío en el día vía moto', address: '' }
		]
	}
];

const seedShippingOptions = async (): Promise<void> => {
	try {
		// Conectar a MongoDB
		const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/electro-hub';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		// Limpiar la colección existente
		await ShippingOption.deleteMany({});
		console.log('🗑️ Opciones de envío existentes eliminadas');

		// Insertar opciones de envío
		const createdOptions = await ShippingOption.insertMany(shippingOptions);
		console.log(`✨ ${createdOptions.length} opciones de envío creadas`);

		// Mostrar opciones creadas
		console.log('\n🚚 Opciones de envío creadas:');
		createdOptions.forEach((option, index) => {
			console.log(`${index + 1}. ${option.name} - $${option.cost}`);
			if (option.pickupPoints && option.pickupPoints.length > 0) {
				option.pickupPoints.forEach((point, pointIndex) => {
					console.log(`   ${pointIndex + 1}. ${point.name} - ${point.address}`);
				});
			}
		});

		console.log('\n🎉 ¡Opciones de envío pobladas exitosamente!');
	} catch (error) {
		console.error('❌ Error al poblar las opciones de envío:', error);
	} finally {
		await mongoose.connection.close();
		console.log('🔒 Conexión cerrada');
		process.exit(0);
	}
};

// Ejecutar solo si se llama directamente
if (require.main === module) {
	seedShippingOptions();
}

export { seedShippingOptions };
