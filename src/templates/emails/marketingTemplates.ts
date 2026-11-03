import {
	buildEmailFooter,
	buildEmailHeader,
	replaceTemplateVariables,
} from './emailLayout';

export interface MarketingEmailResult {
	subject: string;
	html: string;
}

/** 8. Carrito abandonado */
export function buildAbandonedCartEmail(
	userName: string,
	cartItemsHtml: string,
	discountCode: string = 'VUELVE10',
	store: any,
	tpl?: any
): MarketingEmailResult {
	const vars: Record<string, string> = {
		cliente_nombre: userName || 'Cliente',
		nombre_tienda: store.name,
		codigo_cupon: discountCode,
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || '¿Olvidaste algo? Tu carrito te espera en {{nombre_tienda}} 🛒',
		vars
	);
	const heading = replaceTemplateVariables(
		tpl?.heading || '¡No dejes escapar tus favoritos!',
		vars
	);
	const message = replaceTemplateVariables(
		tpl?.message ||
			'Hola {{cliente_nombre}}, guardamos los productos que dejaste en tu carrito para que no te quedes sin stock.',
		vars
	);
	const logoHtml = buildEmailHeader(store);

	const html = `
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

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}

/** 9. Producto volvió a tener stock */
export function buildBackInStockEmail(
	userName: string,
	productName: string,
	productImage: string,
	productPrice: number,
	productSlug: string,
	store: any,
	tpl?: any
): MarketingEmailResult {
	const vars: Record<string, string> = {
		cliente_nombre: userName || 'Cliente',
		nombre_tienda: store.name,
		producto_nombre: productName,
		precio_producto: productPrice.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || '¡Buenas noticias! {{producto_nombre}} volvió a tener stock ✨',
		vars
	);
	const heading = replaceTemplateVariables(
		tpl?.heading || '¡El producto que querías está de vuelta!',
		vars
	);
	const message = replaceTemplateVariables(
		tpl?.message ||
			'Hola {{cliente_nombre}}, te avisamos que {{producto_nombre}} ya tiene stock disponible nuevamente.',
		vars
	);
	const logoHtml = buildEmailHeader(store);

	const html = `
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
        <a href="${store.websiteUrl}/products/${productSlug}" style="display: inline-block; background-color: ${store.branding?.primaryColor || '#111827'}; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: bold; border-radius: 6px;">
          ${tpl?.buttonText || 'Comprar Ahora'}
        </a>
      </div>

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}
