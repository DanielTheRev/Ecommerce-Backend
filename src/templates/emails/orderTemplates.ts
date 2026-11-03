import { IOrder } from '@/interfaces/order.interface';
import {
	buildEmailFooter,
	buildEmailHeader,
	buildItemsHtml,
	replaceTemplateVariables,
} from './emailLayout';

export interface OrderEmailResult {
	subject: string;
	html: string;
}

/** 1. Confirmación de orden de compra */
export function buildOrderConfirmationEmail(
	order: IOrder,
	store: any,
	client: { clientFullName: string; clientFirstName: string },
	tpl?: any
): OrderEmailResult {
	const itemsHtml = buildItemsHtml(order);
	const vars: Record<string, string> = {
		cliente_nombre: client.clientFullName || client.clientFirstName || 'Cliente',
		cliente_primer_nombre: client.clientFirstName || 'Cliente',
		numero_orden: order.orderNumber,
		nombre_tienda: store.name,
		total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
		metodo_envio: order.shippingInfo.type,
		direccion_envio: order.shippingInfo.shippingAddress
			? `${order.shippingInfo.shippingAddress.street} ${order.shippingInfo.shippingAddress.number || ''}, ${order.shippingInfo.shippingAddress.city || ''}`
			: order.shippingInfo.pickupPoint?.name || 'Local comercial',
	};

	const rawSubject = tpl?.subject || '¡Tu pedido #{{numero_orden}} está confirmado! 🎉';
	const subject = replaceTemplateVariables(rawSubject, vars);
	const heading = replaceTemplateVariables(tpl?.heading || '¡Gracias por tu compra, {{cliente_nombre}}!', vars);
	const message = replaceTemplateVariables(
		tpl?.message || 'Recibimos tu pedido correctamente y ya lo estamos preparando para vos.',
		vars
	);
	const extra = tpl?.extraInstructions
		? `<p style="font-size: 14px; color: #555; margin-top: 15px;">${replaceTemplateVariables(tpl.extraInstructions, vars)}</p>`
		: '';
	const primaryColor = store.branding?.primaryColor || '#111827';
	const logoHtml = buildEmailHeader(store);

	const html = `
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

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}

/** 2. Pago en revisión / pendiente */
export function buildPaymentInProcessEmail(
	order: IOrder,
	store: any,
	client: { clientFullName: string },
	tpl?: any
): OrderEmailResult {
	const itemsHtml = buildItemsHtml(order);
	const vars: Record<string, string> = {
		cliente_nombre: client.clientFullName || 'Cliente',
		numero_orden: order.orderNumber,
		nombre_tienda: store.name,
		total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || 'Estamos procesando tu pago del pedido #{{numero_orden}} ⏳',
		vars
	);
	const heading = replaceTemplateVariables(tpl?.heading || 'Tu pago está en revisión', vars);
	const message = replaceTemplateVariables(
		tpl?.message ||
			'Hola {{cliente_nombre}}, la pasarela de pagos está validando la transacción. Te avisaremos apenas se confirme.',
		vars
	);
	const logoHtml = buildEmailHeader(store);

	const html = `
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

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}

/** 3. Instrucciones de transferencia bancaria */
export function buildTransferEmail(
	order: IOrder,
	store: any,
	client: { clientFullName: string; clientFirstName: string },
	bankDetails: { alias: string; cbuCvu: string; bankName: string; titular: string },
	isThirdParty: boolean,
	tpl?: any
): OrderEmailResult {
	const phone = store.phone || '';
	const cleanedPhone = phone.replace(/[^0-9]/g, '');
	const whatsappText = encodeURIComponent(
		`Hola! Acá te envío el comprobante de mi pedido #${order.orderNumber}`
	);
	const whatsappUrl = `https://wa.me/${cleanedPhone}?text=${whatsappText}`;
	const itemsHtml = buildItemsHtml(order);

	const vars: Record<string, string> = {
		cliente_nombre: client.clientFullName || client.clientFirstName || 'Cliente',
		cliente_primer_nombre: client.clientFirstName || 'Cliente',
		numero_orden: order.orderNumber,
		nombre_tienda: store.name,
		total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
		alias_transferencia: bankDetails.alias,
		cbu_transferencia: bankDetails.cbuCvu,
		banco_transferencia: bankDetails.bankName,
		titular_transferencia: bankDetails.titular,
		link_comprobante: whatsappUrl,
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || 'Instrucciones de pago para tu pedido #{{numero_orden}} 💳',
		vars
	);
	const heading = replaceTemplateVariables(tpl?.heading || 'Completá tu pago por transferencia', vars);
	const defaultMessage = isThirdParty
		? `Quedamos a la espera de que el titular envíe la transferencia para finalizar tu compra.`
		: `Hola ${client.clientFirstName}, tu pedido fue reservado. Realizá la transferencia bancaria con los siguientes datos y subí tu comprobante.`;
	const message = replaceTemplateVariables(tpl?.message || defaultMessage, vars);
	const extra = tpl?.extraInstructions
		? `<div style="background-color: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px; border-radius: 8px; font-size: 13px; margin: 15px 0;">${replaceTemplateVariables(tpl.extraInstructions, vars)}</div>`
		: '';
	const buttonText = tpl?.buttonText || 'Enviar Comprobante por WhatsApp';
	const primaryColor = store.branding?.primaryColor || '#10b981';
	const logoHtml = buildEmailHeader(store);

	const html = `
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
          ${bankDetails.alias ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>Alias:</strong></td><td style="font-weight: bold; font-family: monospace; font-size: 15px;">${bankDetails.alias}</td></tr>` : ''}
          ${bankDetails.cbuCvu ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>CBU / CVU:</strong></td><td style="font-family: monospace; font-size: 13px;">${bankDetails.cbuCvu}</td></tr>` : ''}
          ${bankDetails.bankName ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>Banco:</strong></td><td>${bankDetails.bankName}</td></tr>` : ''}
          ${bankDetails.titular ? `<tr><td style="padding: 4px 0; color: #065f46;"><strong>Titular:</strong></td><td>${bankDetails.titular}</td></tr>` : ''}
        </table>
      </div>

      <!-- Botón CTA Comprobante -->
      ${
				cleanedPhone
					? `
      <div style="text-align: center; margin: 25px 0;">
        <a href="${whatsappUrl}" target="_blank" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: bold; border-radius: 8px;">
          💬 ${buttonText}
        </a>
      </div>`
					: ''
			}

      <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">Resumen del Pedido:</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
        ${itemsHtml}
      </table>

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}

/** 4. Pago en efectivo (retiro en local) */
export function buildCashPaymentEmail(
	order: IOrder,
	store: any,
	client: { clientFullName: string },
	tpl?: any
): OrderEmailResult {
	const pickupAddress = order.shippingInfo.pickupPoint?.address || 'nuestro local';
	const pickupName = order.shippingInfo.pickupPoint?.name || '';
	const itemsHtml = buildItemsHtml(order);

	const vars: Record<string, string> = {
		cliente_nombre: client.clientFullName || 'Cliente',
		numero_orden: order.orderNumber,
		nombre_tienda: store.name,
		total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
		punto_retiro: pickupName,
		direccion_retiro: pickupAddress,
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || 'Tu pedido #{{numero_orden}} fue registrado con éxito 💵',
		vars
	);
	const heading = replaceTemplateVariables(tpl?.heading || '¡Pedido registrado, {{cliente_nombre}}!', vars);
	const message = replaceTemplateVariables(
		tpl?.message ||
			'Hola {{cliente_nombre}}, tu pedido fue reservado. Te esperamos en {{punto_retiro}} para abonar y retirar.',
		vars
	);
	const extra = tpl?.extraInstructions
		? `<p style="font-size: 14px; color: #555; margin-top: 15px;">${replaceTemplateVariables(tpl.extraInstructions, vars)}</p>`
		: '';
	const logoHtml = buildEmailHeader(store);

	const html = `
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

      <div style="background-color: #fefce8; border: 1px solid #fef08a; padding: 18px; border-radius: 8px; margin-bottom: 25px;">
        <p style="font-size: 13px; color: #854d0e; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase;">Punto de Retiro & Pago:</p>
        <p style="font-size: 15px; font-weight: bold; margin: 0 0 5px 0; color: #111;">${pickupName}</p>
        <p style="font-size: 13px; color: #555; margin: 0 0 10px 0;">${pickupAddress}</p>
        <p style="font-size: 14px; font-weight: bold; color: #111; margin: 0;">Total a abonar: ${order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</p>
      </div>

      <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">Artículos:</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
        ${itemsHtml}
      </table>

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}

/** 5. Pago recibido y acreditado */
export function buildPaymentReceivedEmail(
	order: IOrder,
	store: any,
	client: { clientFullName: string },
	tpl?: any
): OrderEmailResult {
	const itemsHtml = buildItemsHtml(order);
	const vars: Record<string, string> = {
		cliente_nombre: client.clientFullName || 'Cliente',
		numero_orden: order.orderNumber,
		nombre_tienda: store.name,
		total_orden: order.finance.total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }),
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || '¡Pago acreditado! Tu pedido #{{numero_orden}} está listo para empaquetar 📦',
		vars
	);
	const heading = replaceTemplateVariables(tpl?.heading || '¡Pago acreditado con éxito!', vars);
	const message = replaceTemplateVariables(
		tpl?.message ||
			'Hola {{cliente_nombre}}, verificamos tu pago de {{total_orden}}. Tu orden ya pasó a preparación.',
		vars
	);
	const logoHtml = buildEmailHeader(store);

	const html = `
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

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}

/** 6. Pedido despachado / en camino */
export function buildOrderShippedEmail(
	order: IOrder,
	store: any,
	client: { clientFullName: string },
	tpl?: any
): OrderEmailResult {
	const itemsHtml = buildItemsHtml(order);
	const trackingCode =
		(order.shippingInfo as any).trackingNumber || (order.shippingInfo as any).trackingCode || '';
	const carrier = (order.shippingInfo as any).carrier || '';

	const vars: Record<string, string> = {
		cliente_nombre: client.clientFullName || 'Cliente',
		numero_orden: order.orderNumber,
		nombre_tienda: store.name,
		codigo_seguimiento: trackingCode || 'Sin código asignado',
		transporte: carrier || 'Logística propia',
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || '¡Tu pedido #{{numero_orden}} va en camino! 🚚',
		vars
	);
	const heading = replaceTemplateVariables(tpl?.heading || '¡Tu pedido ya fue despachado!', vars);
	const message = replaceTemplateVariables(
		tpl?.message || 'Hola {{cliente_nombre}}, tu paquete ya está en camino para la entrega.',
		vars
	);
	const extra = tpl?.extraInstructions
		? `<p style="font-size: 14px; color: #555; margin-top: 15px;">${replaceTemplateVariables(tpl.extraInstructions, vars)}</p>`
		: '';
	const logoHtml = buildEmailHeader(store);

	const html = `
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

      ${
				trackingCode
					? `
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 18px; border-radius: 8px; margin-bottom: 25px;">
        <p style="font-size: 13px; color: #166534; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase;">Código de Seguimiento:</p>
        <p style="font-size: 18px; font-weight: 800; font-family: monospace; color: #15803d; margin: 0 0 5px 0;">${trackingCode}</p>
        ${carrier ? `<p style="font-size: 13px; color: #666; margin: 0;">Empresa de envío: <strong>${carrier}</strong></p>` : ''}
      </div>`
					: ''
			}

      <h2 style="font-size: 16px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px; margin: 25px 0 15px 0;">En camino:</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px;">
        ${itemsHtml}
      </table>

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}

/** 7. Pedido entregado */
export function buildOrderDeliveredEmail(
	order: IOrder,
	store: any,
	client: { clientFullName: string },
	tpl?: any
): OrderEmailResult {
	const vars: Record<string, string> = {
		cliente_nombre: client.clientFullName || 'Cliente',
		numero_orden: order.orderNumber,
		nombre_tienda: store.name,
	};

	const subject = replaceTemplateVariables(
		tpl?.subject || '¡Tu pedido #{{numero_orden}} fue entregado! 🛍️',
		vars
	);
	const heading = replaceTemplateVariables(tpl?.heading || '¡Esperamos que disfrutes tu compra!', vars);
	const message = replaceTemplateVariables(
		tpl?.message ||
			'Hola {{cliente_nombre}}, registramos que tu pedido ya fue entregado. ¡Gracias por confiar en {{nombre_tienda}}!',
		vars
	);
	const extra = tpl?.extraInstructions
		? `<p style="font-size: 14px; color: #555; margin-top: 15px;">${replaceTemplateVariables(tpl.extraInstructions, vars)}</p>`
		: '';
	const logoHtml = buildEmailHeader(store);

	const html = `
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

      ${buildEmailFooter(store.branding, store.social, store.name, store.phone)}
    </div>
  `;

	return { subject, html };
}
