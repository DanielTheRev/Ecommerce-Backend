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
}