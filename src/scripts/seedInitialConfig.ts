import dotenv from 'dotenv';
import { EcommerceConfig } from '@/models/Ecommerce.model';
import mongoose from 'mongoose';

dotenv.config();

async function createInitialConfig() {
	try {
		const mongoURI = 'mongodb://localhost:27017/vura_store_db';
		await mongoose.connect(mongoURI);
		console.log('✅ Conectado a MongoDB');

		await EcommerceConfig.create({
			name: 'Vura',
			profit: 10,
			paymentGateways: {
				uala: {
					active: true,
					credentials: {
						userName: process.env.ualaUserName || '',
						clientId: process.env.ualaClientId || '',
						clientSecret: process.env.ualaClientSecret || ''
					},
					baseCommission: 0.049,
					cft3cuotas: 12,
					cft6Cuotas: 18.9
				},
				mercadopago: {}
			},
			callbackURLs: {
				success: process.env.callbackSuccess || '',
				fail: process.env.callbackFail || '',
				notification: process.env.notificationUrl || ''
			}
		});
		console.log('Ecommerce config creada exitosamente');
		process.exit(0);
	} catch (error) {
		console.log('Error al crear Ecommerce config');
		console.log(error);
		process.exit(1);
	}
}

if (require.main === module) {
	createInitialConfig();
}
