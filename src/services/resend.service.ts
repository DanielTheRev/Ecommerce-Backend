import { Resend } from 'resend';
import dotenv from 'dotenv';
import { IOrder } from '@/interfaces/order.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { TenantModels } from '@/config/modelRegistry';
import { IEmailBrandingConfig, IEmailTemplateItem, IEmailTemplatesConfig } from '@/interfaces/ecommerce.interface';

dotenv.config();

export class ResendService {
	static #apikey = process.env.RESEND_API_KEY;
	static readonly DEFAULT_LOGO_URL = '';

	/**
	 * Reemplaza variables tipo {{variable}} o {{ variable }} en un texto
	 */
	static replaceTemplateVariables(template: string, vars: Record<string, string>): string {
		if (!template) return '';
		let result = template;
		for (const [key, value] of Object.entries(vars)) {
			const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
			result = result.replace(regex, value ?? '');
		}
		return result;
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
			const { EcommerceService } = await import('./ecommerce.service');
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
				phone: config.contact?.phone || config.contact?.whatsapp || ''
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
				phone: ''
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

	private static buildEmailHeader(store: any): string {
		if (store.branding?.showStoreLogo === false) return '';
		if (store.logoUrl) {
			return `<img src="${store.logoUrl}" alt="${store.name}" width="120" style="display: block; margin: 0 auto 15px auto; max-height: 50px; object-fit: contain;" />`;
		}
		return `<div style="text-align: center; margin: 0 auto 15px auto; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #111827; text-transform: uppercase;">${store.name}</div>`;
	}

	private static buildEmailFooter(branding?: IEmailBrandingConfig, social?: any, storeName?: string, phone?: string): string {
		const footerText = branding?.footerText || `¡Gracias por comprar en ${storeName || 'nuestra tienda'}! Si tenés alguna duda, respondé directamente a este correo.`;

		let socialHtml = '';
		if (branding?.showSocialLinks !== false) {
			const links = [];
			if (social?.instagram) links.push(`<a href="https://instagram.com/${social.instagram.replace('@', '')}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">Instagram</a>`);
			if (social?.facebook) links.push(`<a href="${social.facebook}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">Facebook</a>`);
			if (social?.tiktok) links.push(`<a href="https://tiktok.com/@${social.tiktok.replace('@', '')}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">TikTok</a>`);
			const whatsapp = social?.whatsapp || phone;
			if (whatsapp) links.push(`<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">WhatsApp</a>`);
			if (links.length > 0) {
				socialHtml = `<div style="margin-top: 15px;">${links.join(' • ')}</div>`;
			}
		}

		return `
			<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee; text-align: center; color: #757575; font-size: 12px;">
				<p style="margin: 0 0 5px 0;">${footerText}</p>
				${socialHtml}
				<p style="margin: 15px 0 0 0; font-size: 11px; color: #999999;">© ${new Date().getFullYear()} ${storeName || 'NexoCommerce'}. Todos los derechos reservados.</p>
			</div>
		`;
	}

	private static async getLogoUrl(models: TenantModels): Promise<string> {
		try {
			const { EcommerceService } = await import('./ecommerce.service');
			const config = await EcommerceService.getConfig(models);
			return config.logo || '';
		} catch (error) {
			console.error('Error fetching dynamic logo for email:', error);
			return '';
		}
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
			isThirdParty
		};
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
			const { clientEmail, clientFullName, clientFirstName } = await ResendService.resolveClient(order, models);
			const itemsHtml = this.buildItemsHtml(order);

			const vars: Record<string, string> = {
				cliente_nombre: clientFullName || clientFirstName || 'Cliente',
				cliente_primer_nombre: clientFirstName || 'Cliente',
				numero_orden: order.orderNumber,
				nombre_tienda: store.name,
				total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
				metodo_envio: order.shippingInfo.type,
				direccion_envio: order.shippingInfo.shippingAddress
					? `${order.shippingInfo.shippingAddress.street} ${order.shippingInfo.shippingAddress.number || ''}, ${order.shippingInfo.shippingAddress.city || ''}`
					: order.shippingInfo.pickupPoint?.name || 'Local comercial'
			};

			const rawSubject = tpl?.subject || '¡Tu pedido #{{numero_orden}} está confirmado! 🎉';
			const subject = this.replaceTemplateVariables(rawSubject, vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || '¡Gracias por tu compra, {{cliente_nombre}}!', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Recibimos tu pedido correctamente y ya lo estamos preparando para vos.', vars);
			const extra = tpl?.extraInstructions ? `<p style="font-size: 14px; color: #555; margin-top: 15px;">${this.replaceTemplateVariables(tpl.extraInstructions, vars)}</p>` : '';
			const primaryColor = store.branding?.primaryColor || '#111827';
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #111;">${heading}</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido #${order.orderNumber}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>
          ${extra}

          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 2px solid ${primaryColor}; padding-bottom: 8px; margin: 25px 0 15px 0; text-transform: uppercase;">Detalle de tu Compra:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
            ${itemsHtml}
          </table>

          <div style="background-color: #f9fafb; padding: 18px; border-radius: 8px; border: 1px solid #f3f4f6; margin-bottom: 25px;">
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 5px 0; font-weight: bold; text-transform: uppercase;">Método de Entrega:</p>
            <p style="font-size: 14px; font-weight: bold; margin: 0 0 5px 0; color: #111;">${order.shippingInfo.type}</p>
            <p style="font-size: 13px; color: #555; margin: 0 0 15px 0;">${vars.direccion_envio}</p>

            <div style="border-top: 1px solid #e5e7eb; pt-10px; margin-top: 10px; padding-top: 10px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; color: #666; margin-bottom: 4px;">
                <span>Costo de Envío:</span>
                <span>${(order.shippingInfo.cost || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #111; margin-top: 8px; border-top: 1px dashed #d1d5db; padding-top: 8px;">
                <span>Total Abonado:</span>
                <span>${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
              </div>
            </div>
          </div>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: clientEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Order confirmation email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send order confirmation email:', error);
		}
	}

	// =========================================================================
	// 2. PAGO EN PROCESO / REVISIÓN
	// =========================================================================
	static async sendPaymentInProcessEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.paymentPending;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);
			const itemsHtml = this.buildItemsHtml(order);

			const vars: Record<string, string> = {
				cliente_nombre: clientFullName || 'Cliente',
				numero_orden: order.orderNumber,
				nombre_tienda: store.name,
				total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || 'Estamos procesando tu pago del pedido #{{numero_orden}} ⏳', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || 'Tu pago está en revisión', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Hola {{cliente_nombre}}, la pasarela de pagos está validando la transacción. Te avisaremos apenas se confirme.', vars);
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #d97706;">${heading}</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido #${order.orderNumber}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>

          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">Resumen del Pedido:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
            ${itemsHtml}
          </table>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: clientEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Payment in process email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send payment in process email:', error);
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
			const { EcommerceService } = await import('./ecommerce.service');
			const config = await EcommerceService.getConfig(models);

			const paymentMethod = await models.PaymentMethod.findOne({
				type: order.paymentInfo.method
			}).lean();

			const alias = paymentMethod?.alias || config.paymentGateways?.transfer?.alias || '';
			const cbuCvu = paymentMethod?.cbuCvu || config.paymentGateways?.transfer?.cbuCvu || '';
			const bankName = paymentMethod?.bankName || config.paymentGateways?.transfer?.bankName || '';
			const titular = paymentMethod?.titular || config.paymentGateways?.transfer?.titular || '';

			const phone = store.phone || '';
			const cleanedPhone = phone.replace(/[^0-9]/g, '');
			const whatsappText = encodeURIComponent(
				`Hola! Acá te envío el comprobante de mi pedido #${order.orderNumber}`
			);
			const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${whatsappText}`;
			const itemsHtml = this.buildItemsHtml(order);

			const { clientEmail, clientFirstName, clientFullName } = await ResendService.resolveClient(order, models);

			const vars: Record<string, string> = {
				cliente_nombre: clientFullName || clientFirstName || 'Cliente',
				cliente_primer_nombre: clientFirstName || 'Cliente',
				numero_orden: order.orderNumber,
				nombre_tienda: store.name,
				total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
				alias_transferencia: alias,
				cbu_transferencia: cbuCvu,
				banco_transferencia: bankName,
				titular_transferencia: titular,
				link_comprobante: whatsappUrl
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || 'Instrucciones de pago para tu pedido #{{numero_orden}} 💳', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || 'Completá tu pago por transferencia', vars);
			const defaultMessage = isThirdParty
				? `Quedamos a la espera de que el titular envíe la transferencia para finalizar tu compra.`
				: `Hola ${clientFirstName}, tu pedido fue reservado. Realizá la transferencia bancaria con los siguientes datos y subí tu comprobante.`;
			const message = this.replaceTemplateVariables(tpl?.message || defaultMessage, vars);
			const extra = tpl?.extraInstructions ? `<div style="background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px; border-radius: 8px; font-size: 13px; margin: 15px 0;">${this.replaceTemplateVariables(tpl.extraInstructions, vars)}</div>` : '';
			const buttonText = tpl?.buttonText || 'Enviar Comprobante por WhatsApp';
			const primaryColor = store.branding?.primaryColor || '#10b981';
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #111;">${heading}</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido #${order.orderNumber}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>
          ${extra}

          <!-- Caja de Datos Bancarios -->
          <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
            <p style="font-size: 13px; font-weight: bold; color: #065f46; margin: 0 0 12px 0; text-transform: uppercase;">Datos para Transferir:</p>
            <table width="100%" style="font-size: 14px; color: #111;">
              <tr><td style="padding: 4px 0; color: #065f46;"><strong>Total a Transferir:</strong></td><td style="font-weight: 800; font-size: 16px; color: #047857;">${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td></tr>
              ${alias ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>Alias:</strong></td><td style="font-weight: bold; font-family: monospace; font-size: 15px;">${alias}</td></tr>` : ''}
              ${cbuCvu ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>CBU / CVU:</strong></td><td style="font-family: monospace; font-size: 13px;">${cbuCvu}</td></tr>` : ''}
              ${bankName ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>Banco:</strong></td><td>${bankName}</td></tr>` : ''}
              ${titular ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>Titular:</strong></td><td>${titular}</td></tr>` : ''}
            </table>
          </div>

          <!-- Botón CTA Comprobante -->
          ${cleanedPhone ? `
          <div style="text-align: center; margin: 25px 0;">
            <a href="${whatsappUrl}" target="_blank" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: bold; border-radius: 8px;">
              💬 ${buttonText}
            </a>
          </div>` : ''}

          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">Resumen del Pedido:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
            ${itemsHtml}
          </table>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data: resData, error } = await resend.emails.send({
				from,
				to: clientEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Transfer instructions email sent:', resData);
		} catch (error: any) {
			console.error('❌ Failed to send transfer email:', error);
		}
	}

	// =========================================================================
	// 4. PAGO EN EFECTIVO (LOCAL / CONTRA ENTREGA)
	// =========================================================================
	static async sendCashPaymentEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.cashPayment;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const pickupAddress = order.shippingInfo.pickupPoint?.address || 'nuestro local';
			const pickupName = order.shippingInfo.pickupPoint?.name || '';
			const itemsHtml = this.buildItemsHtml(order);

			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const vars: Record<string, string> = {
				cliente_nombre: clientFullName || 'Cliente',
				numero_orden: order.orderNumber,
				nombre_tienda: store.name,
				total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
				punto_retiro: pickupName,
				direccion_retiro: pickupAddress
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || 'Tu pedido #{{numero_orden}} fue registrado con éxito 💵', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || '¡Pedido registrado, {{cliente_nombre}}!', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Tu pedido ya fue cargado en nuestro sistema para pago en efectivo al momento del retiro.', vars);
			const extra = tpl?.extraInstructions ? `<div style="background-color: #f3f4f6; padding: 12px; border-radius: 8px; font-size: 13px; margin: 15px 0;">${this.replaceTemplateVariables(tpl.extraInstructions, vars)}</div>` : '';
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #111;">${heading}</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido #${order.orderNumber}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>
          ${extra}

          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 18px; border-radius: 8px; margin-bottom: 25px;">
            ${pickupName ? `<p style="font-size: 14px; margin: 0 0 8px 0;"><strong>Punto de retiro:</strong> ${pickupName}</p>` : ''}
            <p style="font-size: 14px; margin: 0 0 8px 0;"><strong>Dirección:</strong> ${pickupAddress}</p>
            <p style="font-size: 15px; font-weight: bold; margin: 0; color: #4338ca;"><strong>Total a abonar en efectivo:</strong> ${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
          </div>

          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">Tu Pedido:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
            ${itemsHtml}
          </table>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: clientEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Cash instructions email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send cash instructions email:', error);
		}
	}

	// =========================================================================
	// 5. PAGO ACREDITADO / RECIBIDO
	// =========================================================================
	static async sendPaymentReceivedEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.paymentReceived;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const itemsHtml = this.buildItemsHtml(order);
			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const vars: Record<string, string> = {
				cliente_nombre: clientFullName || 'Cliente',
				numero_orden: order.orderNumber,
				nombre_tienda: store.name,
				total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || '¡Pago acreditado! Tu pedido #{{numero_orden}} está listo para empaquetar 📦', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || '¡Pago acreditado con éxito!', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Hola {{cliente_nombre}}, verificamos tu pago de {{total_orden}}. Tu orden ya pasó a preparación.', vars);
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #047857;">${heading}</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido #${order.orderNumber}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>

          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">Resumen del Pedido:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
            ${itemsHtml}
          </table>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: clientEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Payment received email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send payment received email:', error);
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
			const itemsHtml = this.buildItemsHtml(order);
			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const trackingCode = (order.shippingInfo as any).trackingCode || '';
			const carrier = (order.shippingInfo as any).carrier || '';

			const vars: Record<string, string> = {
				cliente_nombre: clientFullName || 'Cliente',
				numero_orden: order.orderNumber,
				nombre_tienda: store.name,
				codigo_seguimiento: trackingCode || 'Sin código asignado',
				transporte: carrier || 'Logística propia'
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || '¡Tu pedido #{{numero_orden}} va en camino! 🚚', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || '¡Tu pedido ya fue despachado!', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Hola {{cliente_nombre}}, tu paquete ya está en camino para la entrega.', vars);
			const extra = tpl?.extraInstructions ? `<p style="font-size: 14px; color: #555; margin-top: 15px;">${this.replaceTemplateVariables(tpl.extraInstructions, vars)}</p>` : '';
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #111;">${heading}</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido #${order.orderNumber}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>
          ${extra}

          ${trackingCode ? `
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 18px; border-radius: 8px; margin-bottom: 25px;">
            <p style="font-size: 13px; color: #166534; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase;">Código de Seguimiento:</p>
            <p style="font-size: 18px; font-weight: 800; font-family: monospace; color: #15803d; margin: 0 0 5px 0;">${trackingCode}</p>
            ${carrier ? `<p style="font-size: 13px; color: #666; margin: 0;">Empresa de envío: <strong>${carrier}</strong></p>` : ''}
          </div>` : ''}

          <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">En camino:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
            ${itemsHtml}
          </table>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: clientEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Order shipped email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send order shipped email:', error);
		}
	}

	// =========================================================================
	// 7. PEDIDO ENTREGADO / RETIRADO
	// =========================================================================
	static async sendOrderDeliveredEmail(order: IOrder, models: TenantModels) {
		try {
			const store = await this.getStoreDetails(models);
			const tpl = store.emailTemplates?.orderDelivered;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);
			const itemsHtml = this.buildItemsHtml(order);
			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const vars: Record<string, string> = {
				cliente_nombre: clientFullName || 'Cliente',
				numero_orden: order.orderNumber,
				nombre_tienda: store.name
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || '¡Tu pedido #{{numero_orden}} fue entregado! 🛍️', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || '¡Esperamos que disfrutes tu compra!', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Hola {{cliente_nombre}}, registramos que tu pedido ya fue entregado. ¡Gracias por confiar en {{nombre_tienda}}!', vars);
			const extra = tpl?.extraInstructions ? `<p style="font-size: 14px; color: #555; margin-top: 15px;">${this.replaceTemplateVariables(tpl.extraInstructions, vars)}</p>` : '';
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #111;">${heading}</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido #${order.orderNumber}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>
          ${extra}

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: clientEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Order delivered email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send order delivered email:', error);
		}
	}

	// =========================================================================
	// 8. CARRITO ABANDONADO
	// =========================================================================
	static async sendAbandonedCartEmail(
		userEmail: string,
		userName: string,
		cartItemsHtml: string,
		discountCode: string = 'VUELVE10',
		models?: TenantModels
	) {
		try {
			const store = models ? await this.getStoreDetails(models) : {
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
				phone: ''
			};

			const tpl = store.emailTemplates?.abandonedCart;
			if (tpl && tpl.enabled === false) return;

			const resend = new Resend(store.apiKey);

			const vars: Record<string, string> = {
				cliente_nombre: userName || 'Cliente',
				nombre_tienda: store.name,
				codigo_cupon: discountCode
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || '¿Olvidaste algo? Tu carrito te espera en {{nombre_tienda}} 🛒', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || '¡No dejes escapar tus favoritos!', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Hola {{cliente_nombre}}, guardamos los productos que dejaste en tu carrito para que no te quedes sin stock.', vars);
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #111;">${heading}</h1>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
            ${cartItemsHtml}
          </table>

          <div style="background-color: #fef2f2; border: 1px dashed #ef4444; padding: 15px; border-radius: 8px; text-align: center; margin: 25px 0;">
            <p style="font-size: 14px; color: #b91c1c; margin: 0 0 5px 0; font-weight: bold;">¡Regalo especial para completar tu compra!</p>
            <p style="font-size: 13px; color: #4b5563; margin: 0;">Usá el cupón <strong style="font-family: monospace; font-size: 16px; color: #b91c1c;">${discountCode}</strong> al finalizar tu compra.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${store.websiteUrl}/cart" style="display: inline-block; background-color: ${store.branding?.primaryColor || '#111827'}; color: #ffffff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: bold; border-radius: 8px;">
              ${tpl?.buttonText || 'Volver al Carrito'}
            </a>
          </div>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: userEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Abandoned cart email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send abandoned cart email:', error);
		}
	}

	// =========================================================================
	// 9. PRODUCTO VUELTO A TENER STOCK (FAVORITOS)
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

			const store = actualModels ? await this.getStoreDetails(actualModels) : {
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
				phone: ''
			};

			const tpl = store.emailTemplates?.backInStock;
			if (tpl && tpl.enabled === false) return true;

			const resend = new Resend(store.apiKey);

			const vars: Record<string, string> = {
				cliente_nombre: userName || 'Cliente',
				nombre_tienda: store.name,
				producto_nombre: productName,
				precio_producto: priceValue.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
			};

			const subject = this.replaceTemplateVariables(tpl?.subject || '¡Buenas noticias! {{producto_nombre}} volvió a tener stock ✨', vars);
			const heading = this.replaceTemplateVariables(tpl?.heading || '¡El producto que querías está de vuelta!', vars);
			const message = this.replaceTemplateVariables(tpl?.message || 'Hola {{cliente_nombre}}, te avisamos que {{producto_nombre}} ya tiene stock disponible nuevamente.', vars);
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
            <h1 style="font-size: 22px; font-weight: 700; margin: 10px 0 5px 0; color: #111;">${heading}</h1>
          </div>

          <p style="font-size: 15px; line-height: 1.5; margin: 20px 0; color: #333;">
            ${message}
          </p>

          <div style="text-align: center; padding: 20px; background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
            ${productImage ? `<img src="${productImage}" alt="${productName}" width="180" style="display: block; margin: 0 auto 15px auto; border-radius: 8px;" />` : ''}
            <h3 style="font-size: 16px; margin: 0 0 5px 0; text-transform: uppercase;">${productName}</h3>
            <p style="font-size: 18px; font-weight: bold; color: #111; margin: 0 0 15px 0;">${vars.precio_producto}</p>
            <a href="${store.websiteUrl}/products/${slugValue}" style="display: inline-block; background-color: ${store.branding?.primaryColor || '#111827'}; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: bold; border-radius: 6px;">
              ${tpl?.buttonText || 'Comprar Ahora'}
            </a>
          </div>

          ${this.buildEmailFooter(store.branding, store.social, store.name, store.phone)}
        </div>
      `;

			const { from, replyTo } = this.getSenderForTemplate(store, tpl);

			const { data, error } = await resend.emails.send({
				from,
				to: userEmail,
				replyTo,
				subject,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Back in stock email sent:', data);
			return true;
		} catch (error: any) {
			console.error('❌ Failed to send back in stock email:', error);
			return false;
		}
	}

	// =========================================================================
	// 10. CÓDIGO OTP / LOGIN
	// =========================================================================
	static async sendOtpEmail(email: string, code: string, models?: TenantModels) {
		try {
			const store = models ? await this.getStoreDetails(models) : {
				name: 'Mi Tienda',
				logoUrl: '',
				websiteUrl: 'https://mitienda.com',
				fromName: 'Mi Tienda',
				rawEmail: 'auth@mitienda.com',
				fromEmail: 'Mi Tienda <auth@mitienda.com>',
				contactEmail: 'contacto@mitienda.com',
				apiKey: this.#apikey || '',
				emailTemplates: undefined,
				branding: undefined,
				social: undefined,
				phone: ''
			};

			const resend = new Resend(store.apiKey);
			const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;
			const logoHtml = this.buildEmailHeader(store);

			const emailHtml = `
        <div style="max-width: 500px; margin: 0 auto; padding: 30px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 12px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 25px; border-bottom: 1px solid #f1f1f1;">
            ${logoHtml}
          </div>

          <div style="text-align: center; padding: 30px 10px;">
            <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 10px 0; letter-spacing: -0.5px; color: #0a0a0a;">Tu código de acceso a ${store.name}</h1>
            <p style="font-size: 14px; color: #666666; margin: 0 0 25px 0;">Ingresá estos 6 dígitos en la tienda para ingresar a tu cuenta:</p>

            <div style="background-color: #f7f7f8; border: 1px dashed #d1d1d6; padding: 18px 24px; border-radius: 8px; display: inline-block; margin-bottom: 25px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #000000;">${formattedCode}</span>
            </div>

            <p style="font-size: 12px; color: #8e8e93; margin: 0;">Este código vence en 10 minutos y es de uso único.</p>
          </div>

          <div style="text-align: center; padding-top: 20px; border-top: 1px solid #f1f1f1;">
            <a href="${store.websiteUrl}" style="font-size: 13px; font-weight: 600; color: #000; text-decoration: none;">${store.name.toUpperCase()}</a>
          </div>
        </div>
      `;

			const from = `${store.fromName || store.name} <${store.rawEmail || 'auth@mitienda.com'}>`;
			const { data, error } = await resend.emails.send({
				from,
				to: email,
				replyTo: store.contactEmail,
				subject: `${store.name} - Tu código de acceso es ${formattedCode}`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ OTP email sent to:', email, data);
			return true;
		} catch (error: any) {
			console.error('❌ Failed to send OTP email:', error);
			return false;
		}
	}

	// =========================================================================
	// 11. ENVÍO DE EMAIL DE PRUEBA DESDE EL PANEL DE CONTROL
	// =========================================================================
	static async sendTestEmail(templateKey: string, recipientEmail: string, models: TenantModels): Promise<boolean> {
		try {
			const mockOrder: any = {
				orderNumber: 'TEST-1234',
				buyerData: {
					firstName: 'Martín',
					lastName: 'Pérez',
					email: recipientEmail
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
						phone: '1123456789'
					},
					cost: 3500,
					shippedAt: new Date(),
					deliveredAt: new Date()
				},
				paymentInfo: {
					method: 'transfer'
				},
				finance: {
					baseCost: 30000,
					earnings: 15000,
					total: 48500
				},
				items: [
					{
						productSnapshot: {
							brand: 'Remera Premium',
							model: 'Oversized Streetwear',
							image: ''
						},
						variantSnapshot: {
							size: 'L',
							color: { name: 'Negro' },
							imageReference: { url: '' }
						},
						price: 22500,
						quantity: 2
					}
				]
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

			return true;
		} catch (error: any) {
			console.error('❌ Error sending test email:', error);
			throw error;
		}
	}

	private static buildItemsHtml(order: IOrder): string {
		if (!order.items || order.items.length === 0) return '';
		return order.items
			.map((item) => {
				const ps = item.productSnapshot;
				const vs = item.variantSnapshot;
				const variantDesc = vs.size
					? `Talle: ${vs.size}${vs.color?.name ? ` | Color: ${vs.color.name}` : ''}`
					: vs.attributes?.map((a: any) => `${a.key}: ${a.value}`).join(' | ') || '';

				const imgUrl = vs.imageReference?.url || (ps as any).image || ResendService.DEFAULT_LOGO_URL;
				return `
      <tr>
        <td width="90" style="padding: 12px 0; border-bottom: 1px solid #eeeeee;">
          <img src="${imgUrl}" alt="${ps.brand + ' ' + ps.model}" width="70" style="display: block; border-radius: 6px; object-fit: cover;" />
        </td>
        <td style="padding: 12px 0 12px 12px; border-bottom: 1px solid #eeeeee; vertical-align: top;">
          <p style="margin: 0 0 4px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; text-transform: uppercase; color: #111;">
            ${ps.brand + ' ' + ps.model}
          </p>
          ${variantDesc ? `<p style="margin: 0 0 4px 0; font-family: Arial, sans-serif; font-size: 12px; color: #757575;">${variantDesc}</p>` : ''}
          <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #111; font-weight: 600;">
            ${item.price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
             <span style="color: #757575; font-weight: normal;">(${item.quantity} un.)</span>
          </p>
        </td>
      </tr>
    `;
			})
			.join('');
	}
}
