import { model, Schema } from 'mongoose';

const EcommerceSchema = new Schema(
	{
		key: { type: String, default: 'global_config' },
		name: { type: String, required: false, default: 'Mi Tienda' },
		logo: { type: String, required: false, default: '' },
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
			},
			maxInstallmentsToAbsorb: {
				type: Number,
				default: 3
			},
			transferDiscountPercentage: {
				type: Number,
				default: 0
			},
			cashDiscountPercentage: {
				type: Number,
				default: 0
			},
			card1PayDiscount: {
				type: Boolean,
				default: false
			}
		},
		// Configuración de Punto de Venta (POS)
		posConfig: {
			transferValidationMode: {
				type: String,
				enum: ['fast_receipt', 'strict_admin_approval'],
				default: 'fast_receipt'
			},
			allowManualDiscount: {
				type: Boolean,
				default: false
			},
			autoPrintReceipt: {
				type: Boolean,
				default: true
			}
		},
		// Integraciones de Marketing, Analytics, Auth y Emails por Tenant
		integrations: {
			metaPixel: {
				active: { type: Boolean, default: false },
				pixelId: { type: String, default: '' },
				accessToken: { type: String, default: '', select: false },
				testEventCode: { type: String, default: '' }
			},
			googleAnalytics: {
				active: { type: Boolean, default: false },
				measurementId: { type: String, default: '' }
			},
			googleAuth: {
				active: { type: Boolean, default: true },
				clientId: { type: String, default: '', select: false }
			},
			resend: {
				active: { type: Boolean, default: false },
				apiKey: { type: String, default: '', select: false },
				fromEmail: { type: String, default: '' },
				fromName: { type: String, default: '' }
			}
		},
		// Configuración de Autenticación de Clientes en Tienda Web
		authConfig: {
			allowEmailPassword: { type: Boolean, default: true },
			allowMagicCode: { type: Boolean, default: true },
			allowGoogle: { type: Boolean, default: true },
			defaultMethod: { type: String, enum: ['google', 'magic_code', 'password'], default: 'google' }
		},
		firstPurchaseDiscount: {
			enabled: { type: Boolean, default: true },
			percentage: { type: Number, default: 10, min: 0, max: 100 }
		},
		costCurrency: {
			type: String,
			enum: ['USD', 'ARS'],
			default: 'USD'
		},
		dollarQuoteType: {
			type: String,
			enum: ['oficial', 'blue', 'bolsa', 'ccl', 'tarjeta', 'mayorista', 'cripto', 'custom'],
			default: 'oficial'
		},
		customDollarRate: {
			type: Number,
			default: 0
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
				cft6Cuotas: { type: Number, required: false, default: 18.9 },
				cft12cuotas: { type: Number, required: false, default: 0 },
				callbackSuccess: { type: String, default: '' },
				callbackFail: { type: String, default: '' },
				notificationUrl: { type: String, default: '' }
			},
			mercadopago: {
				active: { type: Boolean, default: false },
				accessToken: { type: String, default: 'no asignado', select: false },
				publicKey: { type: String, default: 'no asignado' },
				environment: { type: String, enum: ['sandbox', 'production'], default: 'production' },
				checkoutMode: { type: String, enum: ['transparent', 'redirect', 'modal', 'bricks', 'pro', 'api'], default: 'transparent' },
				webhookSecret: { type: String, default: 'no asignado', select: false },
				baseCommission: { type: Number, default: 0.06 },
				cft3cuotas: { type: Number, default: 12 },
				cft6Cuotas: { type: Number, default: 18.9 },
				cft12cuotas: { type: Number, default: 0 },
				maxInstallments: { type: Number, default: 6 },
				excludedPaymentMethods: [{ type: String }],
				excludedPaymentTypes: [{ type: String, default: '' }]
			},
			getnet: {
				active: { type: Boolean, default: false },
				clientId: { type: String, default: '', select: false },
				clientSecret: { type: String, default: '', select: false },
				environment: { type: String, enum: ['sandbox', 'production'], default: 'sandbox' },
				baseCommission: { type: Number, default: 0.035 },
				cft3cuotas: { type: Number, default: 0 },
				cft6Cuotas: { type: Number, default: 10 },
				cft12cuotas: { type: Number, default: 0 },
				maxInstallments: { type: Number, default: 6 },
				checkoutMode: { type: String, enum: ['redirect', 'modal', 'iframe'], default: 'redirect' }
			},
			transfer: {
				active: { type: Boolean, default: false },
				alias: { type: String, default: '' },
				cbuCvu: { type: String, default: '' },
				bankName: { type: String, default: '' },
				titular: { type: String, default: '' }
			}
		},
		workingHours: {
			weekdayStart: { type: String, default: '10:00' },
			weekdayEnd: { type: String, default: '20:00' },
			sundayStart: { type: String, default: '10:00' },
			sundayEnd: { type: String, default: '15:00' },
			noticeText: { type: String, default: 'Lun a Sáb 10-20h / Dom 10-15h' }
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
			address: { type: String, default: '' },
			whatsapp: { type: String, default: '' }
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
		clothingFits: [{
			type: String,
			required: false,
			default: ['Regular', 'Slim', 'Oversized', 'Relaxed', 'Boxy', 'Straight', 'Tapered', 'Baggy']
		}],
		shippingConfig: {
			freeShippingThreshold: { type: Number, default: 50000 }
		},
		recommendationConfig: {
			limit: { type: Number, default: 8, min: 1, max: 24 },
			rules: { type: Schema.Types.Mixed, default: {} }
		},
		emailTemplates: {
			branding: {
				primaryColor: { type: String, default: '#111827' },
				footerText: { type: String, default: '' },
				showSocialLinks: { type: Boolean, default: true },
				showStoreLogo: { type: Boolean, default: true }
			},
			orderConfirmation: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: '¡Tu pedido #{{numero_orden}} está confirmado! 🎉' },
				heading: { type: String, default: '¡Gracias por tu compra, {{cliente_nombre}}!' },
				message: { type: String, default: 'Recibimos tu pedido correctamente y ya lo estamos preparando para vos.' },
				extraInstructions: { type: String, default: '' },
				buttonText: { type: String, default: 'Ver Estado del Pedido' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			bankTransfer: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: 'Instrucciones de pago para tu pedido #{{numero_orden}} 💳' },
				heading: { type: String, default: 'Completá tu pago por transferencia' },
				message: { type: String, default: 'Hola {{cliente_nombre}}, tu pedido fue reservado. Realizá la transferencia bancaria con los siguientes datos y subí el comprobante para que podamos despacharlo.' },
				extraInstructions: { type: String, default: 'Recordá que tenés 24hs para transferir y subir tu comprobante antes de que se libere el stock.' },
				buttonText: { type: String, default: 'Subir Comprobante de Pago' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			cashPayment: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: 'Tu pedido #{{numero_orden}} fue registrado con éxito 💵' },
				heading: { type: String, default: '¡Pedido registrado, {{cliente_nombre}}!' },
				message: { type: String, default: 'Tu pedido ya fue cargado en nuestro sistema para pago en efectivo.' },
				extraInstructions: { type: String, default: 'Podés abonar al momento de retirar en el local o coordinar con nuestro equipo.' },
				buttonText: { type: String, default: 'Ver Detalle del Pedido' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			paymentReceived: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: '¡Pago acreditado! Tu pedido #{{numero_orden}} está listo para empaquetar 📦' },
				heading: { type: String, default: '¡Pago acreditado con éxito!' },
				message: { type: String, default: 'Hola {{cliente_nombre}}, verificamos tu pago de {{total_orden}}. Tu orden ya pasó a preparación.' },
				extraInstructions: { type: String, default: '' },
				buttonText: { type: String, default: 'Seguir Mi Pedido' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			paymentPending: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: 'Estamos procesando tu pago del pedido #{{numero_orden}} ⏳' },
				heading: { type: String, default: 'Tu pago está en revisión' },
				message: { type: String, default: 'Hola {{cliente_nombre}}, la pasarela de pagos está validando la transacción. Te avisaremos apenas se confirme.' },
				extraInstructions: { type: String, default: '' },
				buttonText: { type: String, default: 'Ver Pedido' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			orderShipped: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: '¡Tu pedido #{{numero_orden}} va en camino! 🚚' },
				heading: { type: String, default: '¡Tu pedido ya fue despachado!' },
				message: { type: String, default: 'Hola {{cliente_nombre}}, tu paquete ya está en manos del correo o logística para la entrega.' },
				extraInstructions: { type: String, default: 'Podés hacer el seguimiento de tu envío en tiempo real con el código provisto.' },
				buttonText: { type: String, default: 'Rastrear Envío' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			orderDelivered: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: '¡Tu pedido #{{numero_orden}} fue entregado! 🛍️' },
				heading: { type: String, default: '¡Esperamos que disfrutes tu compra!' },
				message: { type: String, default: 'Hola {{cliente_nombre}}, tu pedido figura como entregado. ¡Gracias por confiar en {{nombre_tienda}}!' },
				extraInstructions: { type: String, default: 'Si te gustó tu producto, nos encantaría que nos dejes tu reseña o nos etiquetes en redes.' },
				buttonText: { type: String, default: 'Volver a la Tienda' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			abandonedCart: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: '¿Olvidaste algo? Tu carrito te espera en {{nombre_tienda}} 🛒' },
				heading: { type: String, default: '¡No dejes escapar tus favoritos!' },
				message: { type: String, default: 'Hola {{cliente_nombre}}, guardamos los productos que dejaste en tu carrito para que no te quedes sin stock.' },
				extraInstructions: { type: String, default: '' },
				buttonText: { type: String, default: 'Recuperar Mi Carrito' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			},
			backInStock: {
				enabled: { type: Boolean, default: true },
				subject: { type: String, default: '¡Buenas noticias! {{producto_nombre}} volvió a tener stock ✨' },
				heading: { type: String, default: '¡El producto que querías está de vuelta!' },
				message: { type: String, default: 'Hola {{cliente_nombre}}, te avisamos que {{producto_nombre}} ya tiene stock disponible nuevamente.' },
				extraInstructions: { type: String, default: '¡Apurate antes de que se agoten las unidades!' },
				buttonText: { type: String, default: 'Comprar Ahora' },
				fromName: { type: String, default: '' },
				fromEmail: { type: String, default: '' },
				replyTo: { type: String, default: '' }
			}
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
