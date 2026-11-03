import { IOrder } from '@/interfaces/order.interface';
import { IEmailBrandingConfig } from '@/interfaces/ecommerce.interface';

export const DEFAULT_LOGO_URL = '';

/** Reemplaza variables en un template de email (ej: {{orderNumber}}, {{clientName}}) */
export function replaceTemplateVariables(template: string, vars: Record<string, string>): string {
	if (!template) return '';
	let result = template;
	for (const [key, val] of Object.entries(vars)) {
		const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
		result = result.replace(regex, val || '');
	}
	return result;
}

/** Construye el encabezado con el logo o nombre de la tienda */
export function buildEmailHeader(store: any): string {
	if (store.branding?.showStoreLogo === false) return '';
	if (store.logoUrl) {
		return `<img src="${store.logoUrl}" alt="${store.name}" width="120" style="display: block; margin: 0 auto 15px auto; max-height: 50px; object-fit: contain;" />`;
	}
	return `<div style="text-align: center; margin: 0 auto 15px auto; font-size: 20px; font-weight: 800; letter-spacing: 0.5px; color: #111827; text-transform: uppercase;">${store.name}</div>`;
}

/** Construye el pie de página con redes sociales y datos de contacto */
export function buildEmailFooter(
	branding?: IEmailBrandingConfig,
	social?: any,
	storeName?: string,
	phone?: string
): string {
	const footerText =
		branding?.footerText ||
		`¡Gracias por comprar en ${storeName || 'nuestra tienda'}! Si tenés alguna duda, respondé directamente a este correo.`;

	let socialHtml = '';
	if (branding?.showSocialLinks !== false) {
		const links = [];
		if (social?.instagram)
			links.push(
				`<a href="https://instagram.com/${social.instagram.replace('@', '')}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">Instagram</a>`
			);
		if (social?.facebook)
			links.push(
				`<a href="${social.facebook}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">Facebook</a>`
			);
		if (social?.tiktok)
			links.push(
				`<a href="https://tiktok.com/@${social.tiktok.replace('@', '')}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">TikTok</a>`
			);
		const whatsapp = social?.whatsapp || phone;
		if (whatsapp)
			links.push(
				`<a href="https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}" style="color: #757575; text-decoration: none; margin: 0 8px; font-size: 12px;">WhatsApp</a>`
			);
		if (links.length > 0) {
			socialHtml = `<div style="margin-top: 15px;">${links.join(' • ')}</div>`;
		}
	}

	return `
		<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eeeeee; text-align: center; color: #757575; font-size: 12px;">
			<p style="margin: 0 0 5px 0;">${footerText}</p>
			${socialHtml}
			<p style="margin: 15px 0 0 0; font-size: 11px; color: #999999;">© ${new Date().getFullYear()} ${storeName || 'Comercio'}. Con tecnología Vexx.</p>
		</div>
	`;
}

/** Construye la tabla HTML con los productos de la orden */
export function buildItemsHtml(order: IOrder): string {
	if (!order.items || order.items.length === 0) return '';
	return order.items
		.map((item) => {
			const ps = item.productSnapshot;
			const vs = item.variantSnapshot;
			const variantDesc = vs?.size
				? `Talle: ${vs.size}${vs.color?.name ? ` | Color: ${vs.color.name}` : ''}`
				: vs?.attributes?.map((a: any) => `${a.key}: ${a.value}`).join(' | ') || '';

			const imgUrl = vs?.imageReference?.url || (ps as any)?.image || DEFAULT_LOGO_URL;
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
