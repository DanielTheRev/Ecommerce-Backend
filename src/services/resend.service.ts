import { Resend } from 'resend';
import dotenv from 'dotenv';
import { IOrder } from '@/interfaces/order.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { TenantModels } from '@/config/modelRegistry';
import { IEcommerceConfig } from '@/interfaces/ecommerce.interface';

dotenv.config();

export class ResendService {
	static #apikey = process.env.RESEND_API_KEY;
	static readonly DEFAULT_LOGO_URL =
		'https://res.cloudinary.com/dmdwze9lj/image/upload/v1775017539/vura/vura_logo_cfrpou.webp';

	private static async getLogoUrl(models: TenantModels): Promise<string> {
		try {
			const { EcommerceService } = await import('./ecommerce.service');
			const config = await EcommerceService.getConfig(models);
			return config.logo || this.DEFAULT_LOGO_URL;
		} catch (error) {
			console.error('Error fetching dynamic logo for email:', error);
			return this.DEFAULT_LOGO_URL;
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

	static async sendOrderConfirmationEmail(order: IOrder, models: TenantModels) {
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);

			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			// 1. Armamos las filas de la tabla iterando los productos (Estilo Nike)
			const itemsHtml = order.items
				.map((item) => {
					const ps = item.productSnapshot;
					const vs = item.variantSnapshot;
					// Descripción de la variante: talle para ropa, atributos para tech
					const variantDesc = vs.size
						? `Talle: ${vs.size}${vs.color?.name ? ` | Color: ${vs.color.name}` : ''}`
						: vs.attributes?.map((a: any) => `${a.key}: ${a.value}`).join(' | ') || '';
					return `
        <tr>
          <td width="100" style="padding: 15px 0; border-bottom: 1px solid #eeeeee;">
            <img src="${vs.imageReference.url}" alt="${ps.brand + ' ' + ps.model}" width="80" style="display: block; border-radius: 4px;" />
          </td>
          <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee; vertical-align: top;">
            <p style="margin: 0 0 5px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; text-transform: uppercase; color: #111;">
              ${ps.brand + ' ' + ps.model}
            </p>
            <p style="margin: 0 0 5px 0; font-family: Arial, sans-serif; font-size: 13px; color: #757575;">
              ${variantDesc}
            </p>
            <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #111;">
              ${item.price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
               <span style="color: #757575;">(${item.quantity} un.)</span>
            </p>
          </td>
        </tr>
      `;
				})
				.join('');

			// 2. Ensamblamos el mail completo
			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${logoUrl}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Gracias por tu compra!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 30px;">
            Hola ${clientFullName}, tu pago fue aprobado y tu compra fue confirmada.
          </p>

          <h2 style="font-size: 18px; font-weight: normal; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 0;">Tu Pedido:</h2>
          <p style="font-size: 14px; color: #757575; margin-top: 5px; margin-bottom: 20px;">
            ${order.items.length} ${order.items.length === 1 ? 'producto' : 'productos'}
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
            ${itemsHtml}
          </table>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
            <p style="font-size: 14px; color: #757575; margin: 0 0 5px 0;">Envío:</p>
            <p style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">
              Tipo: ${order.shippingInfo.type}<br/>
              ${
						order.shippingInfo.type === ShippingType.PICKUP
							? `${order.shippingInfo.pickupPoint?.address}<br/>
                   ${order.shippingInfo.pickupPoint?.name} - CP ${order.shippingInfo.pickupPoint?.name}`
							: `Dirección a coordinar`
					}
            </p>

            <p style="font-size: 14px; color: #757575; margin: 15px 0 5px 0;">Medio de pago:</p>
            <p style="font-size: 14px; font-weight: bold; margin: 0;">
              Total pagado: ${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
          </div>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
            <p style="font-size: 12px; color: #757575; margin-top: 10px;">
              Si tenés dudas con respecto a tu pedido, simplemente respondé a este correo.
            </p>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: clientEmail,
				subject: `Vura - ¡Tu pago #${order.orderNumber} fue aprobado!`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Order confirmation email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send order confirmation email:', error);
		}
	}

	static async sendPaymentInProcessEmail(order: IOrder, models: TenantModels) {
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);

			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const itemsHtml = this.buildItemsHtml(order);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${logoUrl}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Tu pago está en proceso!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 30px;">
            Hola ${clientFullName}, Mercado Pago nos informó que tu pago se encuentra en proceso o revisión.
          </p>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
            No te preocupes, tus productos ya están reservados. Te enviaremos otro correo tan pronto como Mercado Pago nos confirme la acreditación del pago.
          </p>

          <h2 style="font-size: 18px; font-weight: normal; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 0;">Detalle de tu reserva:</h2>
          <p style="font-size: 14px; color: #757575; margin-top: 5px; margin-bottom: 20px;">
            ${order.items.length} ${order.items.length === 1 ? 'producto' : 'productos'}
          </p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
            ${itemsHtml}
          </table>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 4px;">
            <p style="font-size: 14px; color: #757575; margin: 0 0 5px 0;">Envío:</p>
            <p style="font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">
              Tipo: ${order.shippingInfo.type}<br/>
              ${
						order.shippingInfo.type === ShippingType.PICKUP
							? `${order.shippingInfo.pickupPoint?.address}<br/>
                   ${order.shippingInfo.pickupPoint?.name}`
							: `Dirección a coordinar`
					}
            </p>

            <p style="font-size: 14px; color: #757575; margin: 15px 0 5px 0;">Monto total:</p>
            <p style="font-size: 14px; font-weight: bold; margin: 0;">
              Total a pagar: ${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </p>
          </div>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
            <p style="font-size: 12px; color: #757575; margin-top: 10px;">
              Si tenés dudas con respecto a tu pedido, simplemente respondé a este correo.
            </p>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: clientEmail,
				subject: `Vura - Tu pago para el pedido #${order.orderNumber} está en proceso`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Payment in process email sent:', data);
		} catch (error: any) {
			console.error('❌ Failed to send payment in process email:', error);
		}
	}


	static async sendTransferEmail(data: {
		order: IOrder;
		isThirdParty: boolean;
		models: TenantModels;
	}) {
		const { order, models , isThirdParty} = data;
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);

			const { EcommerceService } = await import('./ecommerce.service');
			const config = await EcommerceService.getConfig(models);

			const paymentMethod = await models.PaymentMethod.findOne({
				type: order.paymentInfo.method
			}).lean();

			const alias = paymentMethod?.alias || '';
			const cbuCvu = paymentMethod?.cbuCvu || '';
			const bankName = paymentMethod?.bankName || '';
			const titular = paymentMethod?.titular || '';
			const description =
				paymentMethod?.description || 'Transferencia mediante alias bancario o CVU';

			const phone = config.contact?.phone || '';
			const cleanedPhone = phone.replace(/[^0-9]/g, '');
			const whatsappText = encodeURIComponent(
				`Hola! Acá te envío el comprobante de mi pedido #${order.orderNumber}`
			);
			const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${whatsappText}`;

			const itemsHtml = this.buildItemsHtml(order);

			const { clientEmail, clientFirstName } = await ResendService.resolveClient(order, models);
			const payerFullName = `${order.buyerData.firstName} ${order.buyerData.lastName}`;

			const paymentInstructionText = isThirdParty
				? `Quedamos a la espera de que <strong>${payerFullName}</strong> (registrado como titular de la transferencia en el momento del pago) envíe el dinero a la cuenta detallada a continuación para finalizar tu compra.`
				: `Quedamos a la espera de que realices la transferencia a la cuenta detallada a continuación para finalizar tu compra.`;

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; border: 1px solid #eeeeee; border-radius: 8px; background-color: #ffffff;">
          
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eeeeee;">
            <img src="${logoUrl}" alt="Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 22px; font-weight: normal; margin: 20px 0 5px 0;">¡Ya casi es tuyo! 🚀</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número <strong>#${order.orderNumber}</strong></p>
          </div>

          <p style="font-size: 15px; line-height: 1.6; margin: 25px 0;">
            Hola <strong>${clientFirstName}</strong>, completaste tu compra exitosamente. Reservamos tus productos por las próximas 24 horas. 
            ${paymentInstructionText}
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; font-size: 15px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Datos para Transferir</h3>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 14px; line-height: 2;">
              ${
						bankName
							? `<tr>
                <td width="30%" style="color: #64748b; font-weight: bold;">Banco:</td>
                <td style="color: #0f172a;"><strong>${bankName}</strong></td>
              </tr>`
							: ''
					}
              ${
						cbuCvu
							? `<tr>
                <td width="30%" style="color: #64748b; font-weight: bold;">CBU/CVU:</td>
                <td style="color: #0f172a; font-family: monospace; font-size: 15px;">${cbuCvu}</td>
              </tr>`
							: ''
					}
              ${
						alias
							? `<tr>
                <td width="30%" style="color: #64748b; font-weight: bold;">Alias:</td>
                <td style="color: #0f172a; font-family: monospace; font-size: 15px;">${alias}</td>
              </tr>`
							: ''
					}
              ${
						titular
							? `<tr>
                <td width="30%" style="color: #64748b; font-weight: bold;">Titular:</td>
                <td style="color: #0f172a;">${titular}</td>
              </tr>`
							: ''
					}
              <tr style="border-top: 1px solid #e2e8f0;">
                <td style="color: #0f172a; font-weight: bold; padding-top: 10px; font-size: 15px;">Total a transferir:</td>
                <td style="color: #111; font-weight: bold; padding-top: 10px; font-size: 16px;">
                  ${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
                </td>
              </tr>
            </table>
          </div>

          ${
					phone
						? `
          <div style="text-align: center; background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <p style="font-size: 14px; color: #166534; margin: 0 0 15px 0; line-height: 1.5;">
              <strong>¿Ya realizaste la transferencia?</strong><br/>
              Hacé clic en el siguiente botón para enviarnos el comprobante por WhatsApp y agilizar la confirmación del pago.
            </p>
            <a href="${whatsappUrl}" 
               style="background-color: #25D366; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 30px; display: inline-block; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              💬 Enviar comprobante por WhatsApp
            </a>
          </div>
          `
						: ''
				}

          <h2 style="font-size: 15px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 0;">Detalle de tu reserva:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
            ${itemsHtml}
          </table>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 15px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
            <p style="font-size: 12px; color: #757575; margin-top: 10px;">
              Si tenés alguna pregunta con respecto a tu pedido, simplemente respondé a este correo electrónico.
            </p>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: clientEmail,
				subject: `Vura - Instrucciones de transferencia para tu pedido #${order.orderNumber}`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Transfer instructions email sent to:', clientEmail, data);
		} catch (error: any) {
			console.error('❌ Failed to send transfer instructions email:', error);
		}
	}

	static async sendCashPaymentEmail(order: IOrder, models: TenantModels) {
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);

			const pickupAddress = order.shippingInfo.pickupPoint?.address || 'nuestro local';
			const pickupName = order.shippingInfo.pickupPoint?.name || '';

			const itemsHtml = this.buildItemsHtml(order);

			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${logoUrl}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Ya casi es tuyo!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${clientFullName}, completaste tu orden exitosamente. 
            Elegiste abonar en <strong>Efectivo</strong>. Te estamos esperando para que retires y abones tu pedido en:
          </p>

          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
            <p style="font-size: 14px; margin: 0 0 10px 0;"><strong>Punto de retiro:</strong> ${pickupName}</p>
            <p style="font-size: 14px; margin: 0 0 10px 0;"><strong>Dirección:</strong> ${pickupAddress}</p>
            <p style="font-size: 14px; margin: 0;"><strong>Total a abonar en efectivo:</strong> ${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
          </div>

          <h2 style="font-size: 18px; font-weight: normal; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 0;">Tu Pedido:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
            ${itemsHtml}
          </table>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: clientEmail,
				subject: `Vura - Instrucciones de pago en Efectivo para tu pedido #${order.orderNumber}`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Cash instructions email sent to: ', clientEmail, data);
		} catch (error: any) {
			console.error('❌ Failed to send cash instructions email:', error);
		}
	}

	static async sendPaymentReceivedEmail(order: IOrder, models: TenantModels) {
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);
			const itemsHtml = this.buildItemsHtml(order);

			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${logoUrl}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Pago Recibido!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${clientFullName}, verificamos y aprobamos tu pago exitosamente. Ya estamos preparando tu pedido.
          </p>

          <h2 style="font-size: 18px; font-weight: normal; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 0;">Resumen del Pedido:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
            ${itemsHtml}
          </table>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: clientEmail,
				subject: `Vura - ¡Pago aprobado para tu pedido #${order.orderNumber}!`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Payment received email sent to: ', clientEmail, data);
		} catch (error: any) {
			console.error('❌ Failed to send payment received email:', error);
		}
	}

	static async sendOrderShippedEmail(order: IOrder, models: TenantModels) {
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);
			const itemsHtml = this.buildItemsHtml(order);

			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${logoUrl}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Ya enviamos tu pedido!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${clientFullName}, ¡excelentes noticias! Tu pedido acaba de ser despachado. Pronto estará en tus manos.
          </p>

          <h2 style="font-size: 18px; font-weight: normal; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 0;">En camino:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
            ${itemsHtml}
          </table>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: clientEmail,
				subject: `Vura - ¡Ya enviamos tu pedido #${order.orderNumber}!`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Order shipped email sent to: ', clientEmail, data);
		} catch (error: any) {
			console.error('❌ Failed to send order shipped email:', error);
		}
	}

	static async sendOrderDeliveredEmail(order: IOrder, models: TenantModels) {
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);
			const itemsHtml = this.buildItemsHtml(order);

			const { clientEmail, clientFullName } = await ResendService.resolveClient(order, models);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${logoUrl}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Pedido entregado!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${clientFullName}, registramos que tu pedido ya fue entregado con éxito. ¡Esperamos que lo disfrutes muchísimo!
          </p>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: clientEmail,
				subject: `Vura - ¡Tu pedido #${order.orderNumber} ha sido entregado!`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Order delivered email sent to: ', clientEmail, data);
		} catch (error: any) {
			console.error('❌ Failed to send order delivered email:', error);
		}
	}

	static async sendAbandonedCartEmail(
		userEmail: string,
		userName: string,
		cartItemsHtml: string,
		discountCode: string = 'VUELVE10'
	) {
		try {
			const resend = new Resend(this.#apikey);

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${this.DEFAULT_LOGO_URL}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Te olvidaste algo!</h1>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${userName}, notamos que dejaste algunos productos en tu carrito. 
            Sabemos que la vida a veces nos distrae, ¡así que te guardamos todo!
          </p>

          <div style="background-color: #fce7f3; border: 1px solid #fbcfe8; padding: 20px; border-radius: 4px; margin-bottom: 30px; text-align: center;">
            <p style="font-size: 16px; margin: 0 0 10px 0;">Como sorpresa especial, te regalamos un descuento en tu compra usando el cupón:</p>
            <p style="font-size: 24px; font-weight: bold; color: #be185d; margin: 0; letter-spacing: 2px;">${discountCode}</p>
          </div>

          <h2 style="font-size: 18px; font-weight: normal; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 0;">En tu carrito:</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 30px;">
            ${cartItemsHtml}
          </table>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar/checkout" style="background-color: #111; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">Finalizar Compra</a>
            <p style="font-size: 12px; color: #757575; margin-top: 20px;">
              ¡Apurate antes de que nos quedemos sin stock!
            </p>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: userEmail,
				subject: `Vura - ¡Tus productos te están esperando (Con regalito 🎁)!`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Abandoned cart email sent to: ', userEmail, data);
		} catch (error: any) {
			console.error('❌ Failed to send abandoned cart email:', error);
		}
	}

	static async sendBackInStockEmail(
		userEmail: string,
		userName: string,
		product: {
			brand: string;
			model: string;
			slug: string;
			images: { url: string }[];
			prices: { efectivo_transferencia: number };
		},
		models: TenantModels
	) {
		try {
			const resend = new Resend(this.#apikey);
			const logoUrl = await this.getLogoUrl(models);
			const productName = `${product.brand} ${product.model}`;
			const productImage = product.images?.[0]?.url || '';
			const productUrl = `https://vura.com.ar/products/${product.slug}`;
			const priceFormatted = product.prices.efectivo_transferencia.toLocaleString('es-AR', {
				style: 'currency',
				currency: 'ARS'
			});

			const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="${logoUrl}" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Volvió al stock!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Un producto de tus favoritos ya está disponible</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${userName}, ¡buenas noticias! Un producto que tenés en tus favoritos volvió a estar disponible.
          </p>

          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
              <tr>
                <td width="120" style="padding: 0 15px 0 0; vertical-align: top;">
                  <img src="${productImage}" alt="${productName}" width="100" style="display: block; border-radius: 4px;" />
                </td>
                <td style="vertical-align: top;">
                  <p style="margin: 0 0 5px 0; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-transform: uppercase; color: #111;">
                    ${productName}
                  </p>
                  <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #111;">
                    ${priceFormatted}
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${productUrl}" style="background-color: #111; color: #fff; padding: 14px 32px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; font-size: 16px;">Comprar Ahora</a>
          </div>

          <p style="font-size: 13px; color: #757575; text-align: center; margin-bottom: 30px;">
            ¡Apurate antes de que se agote nuevamente!
          </p>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
          </div>
        </div>
      `;

			const { data, error } = await resend.emails.send({
				from: 'Vura <ordenes@vura.com.ar>',
				to: userEmail,
				subject: `Vura - ¡${productName} volvió al stock!`,
				html: emailHtml
			});

			if (error) throw error;
			console.log('✅ Back in stock email sent to: ', userEmail, data);
			return true;
		} catch (error: any) {
			console.error('❌ Failed to send back in stock email:', error);
			return false;
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

				const imgUrl = vs.imageReference ? vs.imageReference.url : ps.image || '';
				return `
      <tr>
        <td width="100" style="padding: 15px 0; border-bottom: 1px solid #eeeeee;">
          <img src="${imgUrl}" alt="${ps.brand + ' ' + ps.model}" width="80" style="display: block; border-radius: 4px;" />
        </td>
        <td style="padding: 15px 0; border-bottom: 1px solid #eeeeee; vertical-align: top;">
          <p style="margin: 0 0 5px 0; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; text-transform: uppercase; color: #111;">
            ${ps.brand + ' ' + ps.model}
          </p>
          <p style="margin: 0 0 5px 0; font-family: Arial, sans-serif; font-size: 13px; color: #757575;">
            ${variantDesc}
          </p>
          <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #111;">
            ${item.price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
             <span style="color: #757575;">(${item.quantity} un.)</span>
          </p>
        </td>
      </tr>
    `;
			})
			.join('');
	}
}
