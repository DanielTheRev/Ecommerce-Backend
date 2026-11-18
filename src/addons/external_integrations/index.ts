import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const externalIntegrationsSettingsSchema = z.object({
	enableMetaPixelConfig: z.boolean().default(true),
	enableGoogleAnalyticsConfig: z.boolean().default(true),
	enableResendTransactionalEmails: z.boolean().default(true),
	enableEmailTemplatesEditor: z.boolean().default(true)
});

export const externalIntegrationsAddon: AddonModule = {
	manifest: {
		id: 'external_integrations',
		aliases: ['integrations', 'pixels_and_emails', 'transactional_emails'],
		name: 'Integraciones: Meta Pixel/CAPI, GA4 & Emails Resend',
		shortDescription: 'Conexión de Meta Pixel + Conversions API, Google Analytics 4 (GA4), Resend API y editor de plantillas de correos transaccionales.',
		category: 'tracking',
		icon: 'hub',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 5500,
		surfaces: ['admin_module', 'tracker'],
		grantsCapabilities: ['hasExternalIntegrations'],
		requiresSetup: false,
		settingsRoute: '/settings/integrations',
		settingsSchema: externalIntegrationsSettingsSchema,
		configurableLabels: [
			{
				key: 'integrationsTitle',
				label: 'Título de Integraciones & Emails',
				description: 'Encabezado de la pantalla de integraciones externas y correos.',
				defaultValue: 'Integraciones, Píxeles & Emails Transaccionales',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableMetaPixelConfig',
				label: 'Habilitar Meta Pixel & Conversions API (CAPI)',
				description: 'Permite configurar Pixel ID, Access Token y código de eventos de prueba de Meta.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableGoogleAnalyticsConfig',
				label: 'Habilitar Google Analytics 4 (GA4)',
				description: 'Permite configurar el Measurement ID (G-XXXXXXXX) para medición de tráfico y comercio electrónico.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableResendTransactionalEmails',
				label: 'Habilitar motor de correos Resend',
				description: 'Permite conectar una API Key de Resend y remitente propio para envíos automáticos.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableEmailTemplatesEditor',
				label: 'Habilitar editor de plantillas de emails transaccionales',
				description: 'Permite personalizar asunto, textos y colores de los emails de confirmación, transferencia, envío y carrito abandonado.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['checkout', 'storefront_prices'],
			adminScreens: ['settings/integrations', 'settings/emails'],
			storefrontBlocks: ['meta_pixel_tracker', 'ga4_tracker']
		}
	}
};
