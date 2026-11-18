import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const newsletterSettingsSchema = z.object({
	showFooterSubscription: z.boolean().default(true),
	enableSubscriberExportCsv: z.boolean().default(true)
});

export const newsletterAddon: AddonModule = {
	manifest: {
		id: 'newsletter',
		aliases: ['subscribers'],
		name: 'Newsletter & Base de Suscriptores',
		shortDescription: 'Captura de emails de compradores en la tienda web y listado de suscriptores para campañas de fidelización.',
		category: 'marketing',
		icon: 'mail',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasNewsletter'],
		requiresSetup: false,
		settingsRoute: '/home/subscribers',
		settingsSchema: newsletterSettingsSchema,
		configurableLabels: [
			{
				key: 'newsletterTitle',
				label: 'Título del bloque Newsletter en Tienda',
				description: 'Encabezado de la caja de suscripción en el pie de página.',
				defaultValue: 'Suscribite a nuestras novedades',
				surface: 'storefront_section'
			}
		],
		configurableSettings: [
			{
				key: 'showFooterSubscription',
				label: 'Mostrar caja de suscripción en el pie de tienda',
				description: 'Renderiza el formulario de captura de email en el footer.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableSubscriberExportCsv',
				label: 'Permitir exportar base de suscriptores (CSV)',
				description: 'Habilita la descarga del listado de correos suscriptos.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['marketing/newsletter'],
			storefrontBlocks: ['newsletter_signup_block']
		}
	}
};
