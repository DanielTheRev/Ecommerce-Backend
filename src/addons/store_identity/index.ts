import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const storeIdentitySettingsSchema = z.object({
	showWorkingHoursConfig: z.boolean().default(true),
	showSocialLinksConfig: z.boolean().default(true),
	showWhatsappContact: z.boolean().default(true)
});

export const storeIdentityAddon: AddonModule = {
	manifest: {
		id: 'store_identity',
		aliases: ['identity', 'store_profile'],
		name: 'Identidad de Tienda, Horarios & Redes',
		shortDescription: 'Nombre comercial, logotipo, rubro asignado, datos de contacto (WhatsApp, dirección, teléfono), horarios de atención y redes sociales.',
		category: 'operaciones',
		icon: 'store',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: false,
		monthlyPriceARS: 0,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasStoreIdentity', 'hasStoreHoursAndStatus', 'hasSocialLinks'],
		requiresSetup: false,
		settingsRoute: '/settings/identity',
		settingsSchema: storeIdentitySettingsSchema,
		configurableLabels: [
			{
				key: 'identitySectionTitle',
				label: 'Título de Identidad del Comercio',
				description: 'Encabezado de la pantalla de perfil e identidad de la tienda.',
				defaultValue: 'Identidad, Contacto & Horarios',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'showWorkingHoursConfig',
				label: 'Habilitar configuración de Horarios de Atención',
				description: 'Permite definir horarios de Lunes a Sábado, Domingos y texto de aviso.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showSocialLinksConfig',
				label: 'Habilitar enlaces a Redes Sociales',
				description: 'Permite cargar Instagram, TikTok, Facebook y X/Twitter del comercio.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showWhatsappContact',
				label: 'Habilitar línea directa de WhatsApp',
				description: 'Permite configurar el número de WhatsApp comercial para consultas y pedidos.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['pos', 'checkout'],
			adminScreens: ['settings/identity', 'settings/contact', 'settings/hours'],
			storefrontBlocks: ['store_header_identity', 'store_footer_contact', 'working_hours_badge']
		}
	}
};
