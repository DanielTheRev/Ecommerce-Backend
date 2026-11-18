import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const storefrontConnectionSettingsSchema = z.object({
	allowMerchantRegenerateApiKey: z.boolean().default(true),
	allowMerchantEditAllowedOrigins: z.boolean().default(true),
	maxAllowedOrigins: z.coerce.number().int().min(1).max(50).default(10)
});

export const storefrontConnectionAddon: AddonModule = {
	manifest: {
		id: 'storefront_connection',
		aliases: ['headless_api', 'api_connection', 'connection_settings'],
		name: 'Conexión & API Key para Web Externa',
		shortDescription: 'Exposición y rotación de Llave de Tienda (x-api-key pk_live_...) y lista blanca de dominios CORS para conectar páginas web propias o de terceros.',
		category: 'web_storefront',
		icon: 'vpn_key',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 6000,
		surfaces: ['admin_module'],
		grantsCapabilities: ['hasHeadlessApiKey'],
		requiresSetup: false,
		settingsRoute: '/settings/connection',
		settingsSchema: storefrontConnectionSettingsSchema,
		configurableLabels: [
			{
				key: 'connectionTitle',
				label: 'Título de Conexión y API Key',
				description: 'Encabezado de la sección de credenciales para conectar un frontend externo.',
				defaultValue: 'Conexión & Llave de Tienda (API Key)',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'allowMerchantRegenerateApiKey',
				label: 'Permitir al comerciante regenerar su API Key',
				description: 'Si se desactiva, solo el SuperAdmin puede rotar la llave pk_live_... para evitar desconexiones accidentales.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'allowMerchantEditAllowedOrigins',
				label: 'Permitir al comerciante editar dominios permitidos (CORS)',
				description: 'Habilita la edición de allowedOrigins desde el panel del comercio.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'maxAllowedOrigins',
				label: 'Máximo de orígenes CORS permitidos',
				description: 'Cantidad máxima de URLs externas que el comercio puede autorizar.',
				type: 'number',
				defaultValue: 10
			}
		],
		targets: {
			domains: ['storefront_prices', 'checkout'],
			adminScreens: ['settings/connection']
		}
	}
};
