import { Resend } from 'resend';
import { IOrder } from '@/interfaces/order.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { TenantModels } from '@/config/modelRegistry';
import { IEmailBrandingConfig, IEmailTemplateItem, IEmailTemplatesConfig } from '@/interfaces/ecommerce.interface';
import { EcommerceService } from './ecommerce.service';
import {
	DEFAULT_LOGO_URL,
	buildItemsHtml,
	replaceTemplateVariables,
} from '@/templates/emails/emailLayout';
import {
	buildCashPaymentEmail,
	buildOrderConfirmationEmail,
	buildOrderDeliveredEmail,
	buildOrderShippedEmail,
	buildPaymentInProcessEmail,
	buildPaymentReceivedEmail,
	buildTransferEmail,
} from '@/templates/emails/orderTemplates';
import {
	buildAbandonedCartEmail,
	buildBackInStockEmail,
} from '@/templates/emails/marketingTemplates';
import { buildOtpEmail } from '@/templates/emails/authTemplates';

export class ResendService {
	static #apikey = process.env.RESEND_API_KEY;
	static readonly DEFAULT_LOGO_URL = DEFAULT_LOGO_URL;

	/**
	 * Reemplaza variables tipo {{variable}} o {{ variable }} en un texto
	 */
	static replaceTemplateVariables(template: string, vars: Record<string, string>): string {
		return replaceTemplateVariables(template, vars);
	}

	private static async getStoreDetails(models: TenantModels): Promise<{
		name: string;
		logoUrl: string;
		websiteUrl: string;
		fromName: string;
		rawEmail: string;
		fromEmail: string;
		contactEmail: string;
		apiKey: string;
		emailTemplates?: IEmailTemplatesConfig;
		branding?: IEmailBrandingConfig;
		social?: any;
		phone?: string;
	}> {
		try {
			const config = await EcommerceService.getConfig(models);
			const name = config.name || 'Mi Tienda';
			const logoUrl = config.logo || '';
			const fromName = config.integrations?.resend?.fromName || name;
			const rawEmail = config.integrations?.resend?.fromEmail || config.contact?.email || 'ordenes@mitienda.com';
			const fromEmail = `${fromName} <${rawEmail}>`;
			const apiKey = config.integrations?.resend?.apiKey || this.#apikey || '';
			const websiteUrl = config.callbackURLs?.success ? new URL(config.callbackURLs.success).origin : 'https://mitienda.com';
			return {
				name,
				logoUrl,
				websiteUrl,
				fromName,
				rawEmail,
				fromEmail,
				contactEmail: config.contact?.email || rawEmail,
				apiKey,
				emailTemplates: config.emailTemplates,
				branding: config.emailTemplates?.branding,
				social: config.social,
				phone: config.contact?.phone || config.contact?.whatsapp || '',
			};
		} catch (error) {
			console.error('Error fetching store details for email:', error);
			return {
				name: 'Mi Tienda',
				logoUrl: '',
				websiteUrl: 'https://mitienda.com',
				fromName: 'Mi Tienda',
				rawEmail: 'ordenes@mitienda.com',
				fromEmail: 'Mi Tienda <ordenes@mitienda.com>',
				contactEmail: 'contacto@mitienda.com',
				apiKey: this.#apikey || '',
				emailTemplates: undefined,
				branding: undefined,
				social: undefined,
				phone: '',
			};
		}
	}

	private static getSenderForTemplate(store: any, tpl?: IEmailTemplateItem): { from: string; replyTo?: string } {
		const senderName = tpl?.fromName || store.fromName || store.name;
		const senderEmail = tpl?.fromEmail || store.rawEmail || 'ordenes@mitienda.com';
		const from = `${senderName} <${senderEmail}>`;
		const replyTo = tpl?.replyTo || store.contactEmail || undefined;
		return { from, replyTo };
	}

	private static async resolveClient(order: IOrder, models: TenantModels) {
		let orderUser = order.user as any;
		if (orderUser) {
			const userId = orderUser._id || orderUser;
			if (typeof userId === 'string' || (userId && userId.toString)) {
				try {
					const userDoc = await models.User.findById(userId).lean();
					if (userDoc) {
						orderUser = userDoc;
					}
				} catch (error) {
					console.error('Error resolving order user:', error);
				}
			}
		}

		const clientEmail = orderUser?.email || order.buyerData.email;
		const clientFirstName = orderUser?.name?.split(' ')[0] || order.buyerData.firstName;
		const clientLastName =
			orderUser?.name?.split(' ').slice(1).join(' ') || order.buyerData.lastName;
		const clientFullName =
			orderUser?.name || `${order.buyerData.firstName} ${order.buyerData.lastName}`;

		const isThirdParty = orderUser
			? order.buyerData.email.toLowerCase().trim() !== orderUser.email.toLowerCase().trim()
			: false;

		return {
			clientEmail,
			clientFirstName,
			clientLastName,
			clientFullName,
			isThirdParty,
		};
	}

	private static buildItemsHtml(order: IOrder): string {
		return buildItemsHtml(order);
	}

	// =========================================================================
	// 1. CONFIRMACIÓN DE ORDEN / COMPRA (TARJETA / APROBADO)
	// =========================================================================
	static async sendOrderConfirmationEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.orderConfirmation;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const client = await ResendService.resolveClient(order, models);
			const { subject, html } = buildOrderConfirmationEmail(order, store, client, tpl);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: client.clientEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló confirmación a ${client.clientEmail}:`, error);
			else console.log(`📧 [Email Enviado] ✅ Confirmación de Pedido #${order.orderNumber} a "${client.clientEmail}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendOrderConfirmationEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 2. PAGO EN REVISIÓN / PENDIENTE
	// =========================================================================
	static async sendPaymentInProcessEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.paymentPending;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const client = await ResendService.resolveClient(order, models);
			const { subject, html } = buildPaymentInProcessEmail(order, store, client, tpl);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: client.clientEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló pago pendiente a ${client.clientEmail}:`, error);
			else console.log(`📧 [Email Enviado] ⏳ Pago en Revisión #${order.orderNumber} a "${client.clientEmail}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendPaymentInProcessEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 3. INSTRUCCIONES DE TRANSFERENCIA BANCARIA
	// =========================================================================
	static async sendTransferEmail(data: {
		order: IOrder;
		isThirdParty: boolean;
		models: TenantModels;
	}) {
		const { order, models, isThirdParty } = data;
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.bankTransfer;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const config = await EcommerceService.getConfig(models);

			const paymentMethod = await models.PaymentMethod.findOne({
				type: order.paymentInfo.method,
			}).lean();

			const alias = paymentMethod?.alias || config.paymentGateways?.transfer?.alias || '';
			const cbuCvu = paymentMethod?.cbuCvu || config.paymentGateways?.transfer?.cbuCvu || '';
			const bankName = paymentMethod?.bankName || config.paymentGateways?.transfer?.bankName || '';
			const titular = paymentMethod?.titular || config.paymentGateways?.transfer?.titular || '';

			const client = await ResendService.resolveClient(order, models);
			const { subject, html } = buildTransferEmail(
				order,
				store,
				client,
				{ alias, cbuCvu, bankName, titular },
				isThirdParty,
				tpl
			);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data: resData, error } = await resend.emails.send({
				from,
				to: client.clientEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló transferencia a ${client.clientEmail}:`, error);
			else console.log(`📧 [Email Enviado] 💳 Instrucciones Transferencia #${order.orderNumber} a "${client.clientEmail}" (ID: ${resData?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendTransferEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 4. PAGO EN EFECTIVO (RETIRO EN LOCAL)
	// =========================================================================
	static async sendCashPaymentEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.cashPayment;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const client = await ResendService.resolveClient(order, models);
			const { subject, html } = buildCashPaymentEmail(order, store, client, tpl);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: client.clientEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló efectivo a ${client.clientEmail}:`, error);
			else console.log(`📧 [Email Enviado] 💵 Instrucciones Efectivo #${order.orderNumber} a "${client.clientEmail}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendCashPaymentEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 5. PAGO RECIBIDO / ACREDITADO
	// =========================================================================
	static async sendPaymentReceivedEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.paymentReceived;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const client = await ResendService.resolveClient(order, models);
			const { subject, html } = buildPaymentReceivedEmail(order, store, client, tpl);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: client.clientEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló pago recibido a ${client.clientEmail}:`, error);
			else console.log(`📧 [Email Enviado] 📦 Pago Acreditado #${order.orderNumber} a "${client.clientEmail}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendPaymentReceivedEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 6. PEDIDO DESPACHADO / EN CAMINO
	// =========================================================================
	static async sendOrderShippedEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.orderShipped;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const client = await ResendService.resolveClient(order, models);
			const { subject, html } = buildOrderShippedEmail(order, store, client, tpl);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: client.clientEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló orden enviada a ${client.clientEmail}:`, error);
			else console.log(`📧 [Email Enviado] 🚚 Pedido Enviado #${order.orderNumber} a "${client.clientEmail}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendOrderShippedEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 7. PEDIDO ENTREGADO
	// =========================================================================
	static async sendOrderDeliveredEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.orderDelivered;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const client = await ResendService.resolveClient(order, models);
			const { subject, html } = buildOrderDeliveredEmail(order, store, client, tpl);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: client.clientEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló orden entregada a ${client.clientEmail}:`, error);
			else console.log(`📧 [Email Enviado] 🛍️ Pedido Entregado #${order.orderNumber} a "${client.clientEmail}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendOrderDeliveredEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 8. CARRITO ABANDONADO (MARKETING)
	// =========================================================================
	static async sendAbandonedCartEmail(
		userEmail: string,
		userName: string,
		cartItemsHtml: string,
		discountCode: string = 'VUELVE10',
		models?: TenantModels
	) {
		try {
			const store = models
				? await this.getStoreDetails(models)
				: {
						name: 'Mi Tienda',
						logoUrl: '',
						websiteUrl: 'https://mitienda.com',
						fromName: 'Mi Tienda',
						rawEmail: 'ventas@mitienda.com',
						fromEmail: 'Mi Tienda <ventas@mitienda.com>',
						apiKey: this.#apikey || '',
						emailTemplates: undefined,
						branding: undefined,
						social: undefined,
						phone: '',
					};

			const tpl = store.emailTemplates?.abandonedCart;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const { subject, html } = buildAbandonedCartEmail(userName, cartItemsHtml, discountCode, store, tpl);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: userEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló carrito abandonado a ${userEmail}:`, error);
			else console.log(`📧 [Email Enviado] 🛒 Carrito Abandonado a "${userEmail}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendAbandonedCartEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 9. VUELTA A STOCK (MARKETING)
	// =========================================================================
	static async sendBackInStockEmail(
		userEmail: string,
		userName: string,
		productOrName: any,
		modelsOrImg?: any,
		productPrice?: number,
		productSlug?: string,
		models?: TenantModels
	) {
		try {
			let productName = '';
			let productImage = '';
			let priceValue = 0;
			let slugValue = '';
			let actualModels: TenantModels | undefined;

			if (typeof productOrName === 'object' && productOrName !== null) {
				productName = `${productOrName.brand || ''} ${productOrName.model || ''}`.trim() || 'Producto';
				productImage = productOrName.images?.[0]?.url || '';
				priceValue = productOrName.prices?.efectivo_transferencia || 0;
				slugValue = productOrName.slug || '';
				actualModels = modelsOrImg as TenantModels;
			} else {
				productName = productOrName || 'Producto';
				productImage = typeof modelsOrImg === 'string' ? modelsOrImg : '';
				priceValue = productPrice || 0;
				slugValue = productSlug || '';
				actualModels = models;
			}

			const store = actualModels
				? await this.getStoreDetails(actualModels)
				: {
						name: 'Mi Tienda',
						logoUrl: '',
						websiteUrl: 'https://mitienda.com',
						fromName: 'Mi Tienda',
						rawEmail: 'ventas@mitienda.com',
						fromEmail: 'Mi Tienda <ventas@mitienda.com>',
						apiKey: this.#apikey || '',
						emailTemplates: undefined,
						branding: undefined,
						social: undefined,
						phone: '',
					};

			const tpl = store.emailTemplates?.backInStock;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const { subject, html } = buildBackInStockEmail(
				userName,
				productName,
				productImage,
				priceValue,
				slugValue,
				store,
				tpl
			);
			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: userEmail,
				replyTo,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló vuelta a stock a ${userEmail}:`, error);
			else console.log(`📧 [Email Enviado] ✨ Back in Stock para "${productName}" enviado a "${userEmail}" (ID: ${data?.id})`);
			return true;
		} catch (error) {
			console.error(`❌ [Email Exception] sendBackInStockEmail fallo inesperado:`, error);
			return false;
		}
	}

	// =========================================================================
	// 10. CÓDIGO OTP DE ACCESO / LOGIN (AUTH)
	// =========================================================================
	static async sendOtpEmail(email: string, code: string, models?: TenantModels) {
		try {
			const store = models
				? await this.getStoreDetails(models)
				: {
						name: 'Mi Tienda',
						logoUrl: '',
						websiteUrl: 'https://mitienda.com',
						fromName: 'Mi Tienda',
						rawEmail: 'auth@mitienda.com',
						fromEmail: 'Mi Tienda <auth@mitienda.com>',
						apiKey: this.#apikey || '',
						emailTemplates: undefined,
						branding: undefined,
						social: undefined,
						phone: '',
					};

			const resend = new Resend(store.apiKey);
			const { subject, html } = buildOtpEmail(store, code);

			const { data, error } = await resend.emails.send({
				from: store.fromEmail,
				to: email,
				subject,
				html,
			});

			if (error) console.error(`❌ [Email Error] Falló OTP a ${email}:`, error);
			else console.log(`📧 [Email Enviado] 🔑 Código OTP enviado a "${email}" (ID: ${data?.id})`);
		} catch (error) {
			console.error(`❌ [Email Exception] sendOtpEmail fallo inesperado:`, error);
		}
	}

	// =========================================================================
	// 11. EMAIL DE PRUEBA (DESDE PANEL DE CONTROL)
	// =========================================================================
	static async sendTestEmail(templateKey: string, recipientEmail: string, models: TenantModels): Promise<boolean> {
		try {
			const mockOrder: any = {
				orderNumber: 'TEST-1234',
				buyerData: {
					firstName: 'Martín',
					lastName: 'Pérez',
					email: recipientEmail,
				},
				shippingInfo: {
					type: ShippingType.HOME_DELIVERY,
					shippingAddress: {
						recipientName: 'Martín Pérez',
						street: 'Av. Santa Fe',
						number: '3200',
						city: 'Palermo, CABA',
						state: 'Buenos Aires',
						zipCode: '1425',
						phone: '1123456789',
					},
					cost: 3500,
					shippedAt: new Date(),
					deliveredAt: new Date(),
				},
				paymentInfo: {
					method: 'transfer',
				},
				finance: {
					baseCost: 30000,
					earnings: 15000,
					total: 48500,
				},
				items: [
					{
						productSnapshot: {
							brand: 'Remera Premium',
							model: 'Oversized Streetwear',
							image: '',
						},
						variantSnapshot: {
							size: 'L',
							color: { name: 'Negro' },
							imageReference: { url: '' },
						},
						price: 22500,
						quantity: 2,
					},
				],
			};

			switch (templateKey) {
				case 'orderConfirmation':
					await this.sendOrderConfirmationEmail(mockOrder, models);
					break;
				case 'bankTransfer':
					await this.sendTransferEmail({ order: mockOrder, isThirdParty: false, models });
					break;
				case 'cashPayment':
					await this.sendCashPaymentEmail(mockOrder, models);
					break;
				case 'paymentReceived':
					await this.sendPaymentReceivedEmail(mockOrder, models);
					break;
				case 'paymentPending':
					await this.sendPaymentInProcessEmail(mockOrder, models);
					break;
				case 'orderShipped':
					await this.sendOrderShippedEmail(mockOrder, models);
					break;
				case 'orderDelivered':
					await this.sendOrderDeliveredEmail(mockOrder, models);
					break;
				case 'abandonedCart':
					await this.sendAbandonedCartEmail(recipientEmail, 'Martín Pérez', this.buildItemsHtml(mockOrder), 'PROMO10', models);
					break;
				case 'backInStock':
					await this.sendBackInStockEmail(recipientEmail, 'Martín Pérez', 'Remera Premium Oversized', '', 22500, 'remera-premium', models);
					break;
				default:
					await this.sendOrderConfirmationEmail(mockOrder, models);
					break;
			}

			console.log(`📧 [Email Enviado] 🧪 Email de Prueba enviado exitosamente a "${recipientEmail}" | Plantilla: ${templateKey}`);
			return true;
		} catch (error: any) {
			console.error(`❌ [Email Error] Falló el envío de email de prueba a ${recipientEmail}:`, error);
			throw error;
		}
	}
}
