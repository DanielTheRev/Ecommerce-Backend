import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const emailStudioSettingsSchema = z.object({
	enableResendIntegration: z.boolean().default(true),
	enableEmailBranding: z.boolean().default(true),
	enableOrderConfirmationEmail: z.boolean().default(true),
	enableBankTransferEmail: z.boolean().default(true),
	enableShippingStatusEmails: z.boolean().default(true),
	enableAbandonedCartEmail: z.boolean().default(true),
	enableBackInStockEmail: z.boolean().default(true)
});

export const emailStudioAddon: AddonModule = {
	manifest: {
		id: 'email_studio',
		aliases: ['resend_emails', 'transactional_emails', 'email_templates'],
		name: 'Email Studio (Resend & Plantillas Transaccionales)',
		shortDescription:
			'Conexión con Resend (API Key y remitente propio), diseño de marca para correos y editor de las 9 plantillas transaccionales (orden, transferencia, envío, carrito abandonado).',
		category: 'marketing',
		icon: 'mark_email_read',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4500,
		surfaces: ['admin_module'],
		grantsCapabilities: ['hasExternalIntegrations'],
		requiresSetup: true,
		settingsRoute: '/home/emails',
		settingsSchema: emailStudioSettingsSchema,
		configurableLabels: [
			{
				key: 'emailStudioTitle',
				label: 'Título de Email Studio',
				description: 'Encabezado de la pantalla unificada de Resend y plantillas de correo.',
				defaultValue: 'Email Studio & Plantillas Transaccionales',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableResendIntegration',
				label: 'Habilitar credenciales de Resend (API Key & Remitente)',
				description: 'Permite configurar apiKey, fromEmail y fromName en la misma vista de Email Studio.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableEmailBranding',
				label: 'Habilitar personalización de Branding (Logo, Color, Pie de firma)',
				description: 'Permite ajustar el color primario, logo y redes sociales en el encabezado/pie de los correos.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableOrderConfirmationEmail',
				label: 'Plantilla: Confirmación de Orden y Pago Recibido',
				description: 'Habilita la edición de correos automáticos al comprar.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableBankTransferEmail',
				label: 'Plantilla: Instrucciones de Transferencia Bancaria / Efectivo',
				description: 'Envía automáticamente el Alias/CBU y el link para subir el comprobante.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableShippingStatusEmails',
				label: 'Plantillas: Pedido Enviado y Pedido Entregado',
				description: 'Notifica al comprador cuando su paquete sale a distribución o es entregado.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableAbandonedCartEmail',
				label: 'Plantilla: Recupero de Carrito Abandonado',
				description: 'Recordatorio automático para carritos no finalizados.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableBackInStockEmail',
				label: 'Plantilla: Aviso de Reingreso de Stock',
				description: 'Notifica a los clientes interesados cuando vuelve a entrar un producto agotado.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['checkout'],
			adminScreens: ['marketing/email-studio', 'settings/emails']
		}
	}
};
