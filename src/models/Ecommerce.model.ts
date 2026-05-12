import { model, Schema } from 'mongoose';

const EcommerceSchema = new Schema(
	{
		key: { type: String, default: 'global_config' },
		name: { type: String, required: false, default: 'Mi Tienda' },
		// Configuración de Ganancias
		profit: {
			type: Number,
			default: 10, // por defecto el 10% — fallback legacy
			min: 0
		},
		profit1Pay: {
			type: Number,
			min: 0
		},
		profitInstallments: {
			type: Number,
			min: 0
		},
		taxes: {
			iva: { type: Number, default: 21 } // en argentina es 21%
		},
		// Estrategia de Pricing — configurable por el vendedor
		pricingStrategy: {
			method: {
				type: String,
				enum: ['markup', 'margin'],
				default: 'markup'
			},
			transferGrossUp: {
				type: Boolean,
				default: true
			},
			absorbInstallments: {
				type: Boolean,
				default: true
			}
		},
		costCurrency: {
			type: String,
			enum: ['USD', 'ARS'],
			default: 'USD'
		},
		// Pasarelas de Pago
		paymentGateways: {
			uala: {
				active: { type: Boolean, default: false },
				credentials: {
					userName: { type: String, select: false },
					clientId: { type: String, select: false },
					clientSecret: { type: String, select: false }
				},
				baseCommission: { type: Number, required: false, default: 0.049 },
				cft3cuotas: { type: Number, required: false, default: 12 },
				cft6Cuotas: { type: Number, required: false, default: 18.9 }
			},
			mercadopago: {
				active: { type: Boolean, default: false },
				accessToken: { type: String, default: 'no asignado', select: false },
				publicKey: { type: String, default: 'no asignado' },
				webhookSecret: { type: String, default: 'no asignado', select: false },
				baseCommission: { type: Number, default: 0.06 },
				cft3cuotas: { type: Number, default: 12 },
				cft6Cuotas: { type: Number, default: 18.9 },
				maxInstallments: { type: Number, default: 6 },
				excludedPaymentMethods: [{ type: String }],
				excludedPaymentTypes: [{ type: String, default: '' }]
			},
			transfer: {
				active: { type: Boolean, default: false },
				alias: { type: String, default: '' },
				cbuCvu: { type: String, default: '' },
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
		brands: [{
			type: String,
			required: false,
			default: []
		}],
		categories: [{
			type: String,
			required: false,
			default: []
		}],
		shippingConfig: {
			freeShippingThreshold: { type: Number, default: 50000 }
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
