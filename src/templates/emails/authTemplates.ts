import { buildEmailHeader } from './emailLayout';

export interface AuthEmailResult {
	subject: string;
	html: string;
}

/** 10. Código OTP de Acceso / Login */
export function buildOtpEmail(store: any, code: string): AuthEmailResult {
	const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;
	const logoHtml = buildEmailHeader(store);

	const html = `
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

	const subject = `${store.name} - Tu código de acceso es ${formattedCode}`;

	return { subject, html };
}
