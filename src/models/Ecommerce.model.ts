import { model, Schema } from 'mongoose';

const EcommerceSchema = new Schema(
	{
		key: { type: String, default: 'global_config' },
		name: { type: String, required: true },
		// Configuración de Ganancias
		profit: {
			default: { type: Number, default: 10 }, // por defecto el 10%
			type: Number,
			min: 0
		},
		taxes: {
			iva: { type: Number, default: 21 } // en argentina es 21%
		},
		// Pasarelas de Pago
		paymentGateways: {
			uala: {
				active: { type: Boolean, default: true },
				credentials: {
					userName: { type: String },
					clientId: { type: String },
					clientSecret: { type: String }
				},
				baseCommission: { type: Number, required: true },
				cft3cuotas: { type: Number, required: true },
				cft6Cuotas: { type: Number, required: true }
			},
			mercadopago: {
				active: { type: Boolean, default: false },
				accessToken: { type: String , default: 'no asignado'},
				publicKey: { type: String ,default: 'no asignado'},
				baseCommission: { type: Number, default: 0.06 }
			}
		},
		callbackURLs: {
			success: { type: String, required: true },
			fail: { type: String, required: true },
			notification: { type: String, required: true }
		},
		// Metadata para el CMS
		lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }
	},
	{ timestamps: true, versionKey: false }
);

export const EcommerceConfig = model('EcommerceConfig', EcommerceSchema);
