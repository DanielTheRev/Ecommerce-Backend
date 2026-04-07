import { Resend } from "resend";
import dotenv from 'dotenv';
import { IOrder } from "@/interfaces/order.interface";
import { ShippingType } from "@/interfaces/shippingMethods.interface";
import { TenantModels } from "@/config/modelRegistry";
import { IEcommerceConfig } from "@/interfaces/ecommerce.interface";

dotenv.config();

export class ResendService {
  static #apikey = process.env.RESEND_API_KEY;

  static async sendOrderConfirmationEmail(order: IOrder) {
    try {
      const resend = new Resend(this.#apikey);

      // 1. Armamos las filas de la tabla iterando los productos (Estilo Nike)
      const itemsHtml = order.items.map(item => {
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
      }).join('');


      // 2. Ensamblamos el mail completo
      const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="https://res.cloudinary.com/dmdwze9lj/image/upload/v1775017539/vura/vura_logo_cfrpou.webp" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Gracias por tu compra!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 30px;">
            Hola ${order.buyerData.firstName + ' ' + order.buyerData.lastName}, tu pago fue aprobado y tu compra fue confirmada.
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
              ${order.shippingInfo.type === ShippingType.PICKUP ? `${order.shippingInfo.pickupPoint?.address}<br/>
                   ${order.shippingInfo.pickupPoint?.name} - CP ${order.shippingInfo.pickupPoint?.name}` : `Dirección a coordinar`}
            </p>

            <p style="font-size: 14px; color: #757575; margin: 15px 0 5px 0;">Medio de pago:</p>
            <p style="font-size: 14px; font-weight: bold; margin: 0;">
              Total pagado: ${order.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
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
        to: order.buyerData.email,
        subject: `Vura - ¡Tu pago #${order.orderNumber} fue aprobado!`,
        html: emailHtml,
      });

      if (error) throw error;
      console.log('✅ Order confirmation email sent:', data);
    } catch (error: any) {
      console.error('❌ Failed to send order confirmation email:', error);
    }
  }

  static async sendTransferEmail(order: IOrder, models: TenantModels) {
    const storeConfig: IEcommerceConfig | null = null
  }

  static async sendCashPaymentEmail(order: IOrder) {
    try {
      const resend = new Resend(this.#apikey);
      
      const pickupAddress = order.shippingInfo.pickupPoint?.address || 'nuestro local';
      const pickupName = order.shippingInfo.pickupPoint?.name || '';

      const itemsHtml = this.buildItemsHtml(order);

      const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="https://res.cloudinary.com/dmdwze9lj/image/upload/v1775017539/vura/vura_logo_cfrpou.webp" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Ya casi es tuyo!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${order.buyerData.firstName + ' ' + order.buyerData.lastName}, completaste tu orden exitosamente. 
            Elegiste abonar en <strong>Efectivo</strong>. Te estamos esperando para que retires y abones tu pedido en:
          </p>

          <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
            <p style="font-size: 14px; margin: 0 0 10px 0;"><strong>Punto de retiro:</strong> ${pickupName}</p>
            <p style="font-size: 14px; margin: 0 0 10px 0;"><strong>Dirección:</strong> ${pickupAddress}</p>
            <p style="font-size: 14px; margin: 0;"><strong>Total a abonar en efectivo:</strong> ${order.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
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
        to: order.buyerData.email,
        subject: `Vura - Instrucciones de pago en Efectivo para tu pedido #${order.orderNumber}`,
        html: emailHtml,
      });

      if (error) throw error;
      console.log('✅ Cash instructions email sent to: ', order.buyerData.email, data);
    } catch (error: any) {
      console.error('❌ Failed to send cash instructions email:', error);
    }
  }

  static async sendPaymentReceivedEmail(order: IOrder) {
    try {
      const resend = new Resend(this.#apikey);
      const itemsHtml = this.buildItemsHtml(order);

      const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="https://res.cloudinary.com/dmdwze9lj/image/upload/v1775017539/vura/vura_logo_cfrpou.webp" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Pago Recibido!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${order.buyerData.firstName + ' ' + order.buyerData.lastName}, verificamos y aprobamos tu pago exitosamente. Ya estamos preparando tu pedido.
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
        to: order.buyerData.email,
        subject: `Vura - ¡Pago aprobado para tu pedido #${order.orderNumber}!`,
        html: emailHtml,
      });

      if (error) throw error;
      console.log('✅ Payment received email sent to: ', order.buyerData.email, data);
    } catch (error: any) {
      console.error('❌ Failed to send payment received email:', error);
    }
  }

  static async sendOrderShippedEmail(order: IOrder) {
    try {
      const resend = new Resend(this.#apikey);
      const itemsHtml = this.buildItemsHtml(order);

      const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="https://res.cloudinary.com/dmdwze9lj/image/upload/v1775017539/vura/vura_logo_cfrpou.webp" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Ya enviamos tu pedido!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${order.buyerData.firstName + ' ' + order.buyerData.lastName}, ¡excelentes noticias! Tu pedido acaba de ser despachado. Pronto estará en tus manos.
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
        to: order.buyerData.email,
        subject: `Vura - ¡Ya enviamos tu pedido #${order.orderNumber}!`,
        html: emailHtml,
      });

      if (error) throw error;
      console.log('✅ Order shipped email sent to: ', order.buyerData.email, data);
    } catch (error: any) {
      console.error('❌ Failed to send order shipped email:', error);
    }
  }

  static async sendOrderDeliveredEmail(order: IOrder) {
    try {
      const resend = new Resend(this.#apikey);
      const itemsHtml = this.buildItemsHtml(order);

      const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="https://res.cloudinary.com/dmdwze9lj/image/upload/v1775017539/vura/vura_logo_cfrpou.webp" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
            <h1 style="font-size: 24px; font-weight: normal; margin: 20px 0 5px 0;">¡Pedido entregado!</h1>
            <p style="font-size: 14px; color: #757575; margin: 0;">Pedido número #${order.orderNumber}</p>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Hola ${order.buyerData.firstName + ' ' + order.buyerData.lastName}, registramos que tu pedido ya fue entregado con éxito. ¡Esperamos que lo disfrutes muchísimo!
          </p>

          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee;">
            <a href="https://vura.com.ar" style="font-size: 16px; font-weight: bold; color: #111; text-decoration: none;">Vura.com.ar</a>
          </div>
        </div>
      `;

      const { data, error } = await resend.emails.send({
        from: 'Vura <ordenes@vura.com.ar>',
        to: order.buyerData.email,
        subject: `Vura - ¡Tu pedido #${order.orderNumber} ha sido entregado!`,
        html: emailHtml,
      });

      if (error) throw error;
      console.log('✅ Order delivered email sent to: ', order.buyerData.email, data);
    } catch (error: any) {
      console.error('❌ Failed to send order delivered email:', error);
    }
  }

  static async sendAbandonedCartEmail(userEmail: string, userName: string, cartItemsHtml: string, discountCode: string = 'VUELVE10') {
    try {
      const resend = new Resend(this.#apikey);

      const emailHtml = `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111;">
          <div style="text-align: center; padding-bottom: 20px;">
            <img src="https://res.cloudinary.com/dmdwze9lj/image/upload/v1775017539/vura/vura_logo_cfrpou.webp" alt="Vura Logo" width="120" style="display: block; margin: 0 auto;" />
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
        html: emailHtml,
      });

      if (error) throw error;
      console.log('✅ Abandoned cart email sent to: ', userEmail, data);
    } catch (error: any) {
      console.error('❌ Failed to send abandoned cart email:', error);
    }
  }

  private static buildItemsHtml(order: IOrder): string {
    if (!order.items || order.items.length === 0) return '';
    return order.items.map(item => {
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
    }).join('');
  }
}