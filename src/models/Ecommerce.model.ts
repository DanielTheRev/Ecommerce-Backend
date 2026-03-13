import { model, Schema } from 'mongoose';

const EcommerceSchema = new Schema(
	{
		key: { type: String, default: 'global_config' },
		name: { type: String, required: false, default: 'Mi Tienda' },
		// Configuración de Ganancias
		profit: {
			type: Number,
			default: 10, // por defecto el 10%
			min: 0
		},
		taxes: {
			iva: { type: Number, default: 21 } // en argentina es 21%
		},
		// Pasarelas de Pago
		paymentGateways: {
			uala: {
				active: { type: Boolean, default: false },
				credentials: {
					userName: { type: String },
					clientId: { type: String },
					clientSecret: { type: String }
				},
				baseCommission: { type: Number, required: false, default: 0.049 },
				cft3cuotas: { type: Number, required: false, default: 12 },
				cft6Cuotas: { type: Number, required: false, default: 18.9 }
			},
			mercadopago: {
				active: { type: Boolean, default: false },
				accessToken: { type: String, default: 'no asignado' },
				publicKey: { type: String, default: 'no asignado' },
				baseCommission: { type: Number, default: 0.06 }
			}
		},
		callbackURLs: {
			success: { type: String, required: false, default: '' },
			fail: { type: String, required: false, default: '' },
			notification: { type: String, required: false, default: '' }
		},
		// Contact info
		contact: {
			email: { type: String, default: '' },
			phone: { type: String, default: '' },
			address: { type: String, default: '' }
		},
		// Social Networks
		social: {
			instagram: { type: String, default: '' },
			facebook: { type: String, default: '' },
			twitter: { type: String, default: '' },
			tiktok: { type: String, default: '' }
		},
		// Metadata para el CMS
		lastModifiedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false }
	},
	{ timestamps: true, versionKey: false }
);

// Hook removed to move logic to Service layer

// Schema exportado para multi-tenancy (model registry)
export { EcommerceSchema };

export const EcommerceConfig = model('EcommerceConfig', EcommerceSchema);
