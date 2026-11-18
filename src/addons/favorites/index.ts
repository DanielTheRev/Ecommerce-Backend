import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const favoritesSettingsSchema = z.object({
	enableBackInStockNotifications: z.boolean().default(true),
	showFavoriteCountInStorefront: z.boolean().default(false)
});

export const favoritesAddon: AddonModule = {
	manifest: {
		id: 'favorites',
		aliases: ['wishlist', 'likes'],
		name: 'Favoritos & Aviso de Stock',
		shortDescription:
			'Permite a tus clientes guardar productos en favoritos, muestra en el panel los más deseados y te deja enviarles un mail cuando vuelve el stock.',
		category: 'marketing',
		icon: 'favorite',
		implementationStatus: 'ready',
		includedInPlans: [],
		minPlanTier: VexxPlanTier.PRO,
		isPurchasable: true,
		monthlyPriceARS: 0,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasFavorites'],
		requiresSetup: false,
		settingsRoute: '/home/favorites',
		settingsSchema: favoritesSettingsSchema,
		configurableSettings: [
			{
				key: 'enableBackInStockNotifications',
				label: 'Habilitar aviso de reposición de stock por email',
				description: 'Permite enviar notificaciones por correo a los clientes que guardaron el producto.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showFavoriteCountInStorefront',
				label: 'Mostrar contador de favoritos en la tienda',
				description: 'Muestra cuántas personas marcaron el producto en el Storefront.',
				type: 'boolean',
				defaultValue: false
			}
		],
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['marketing/favorites'],
			storefrontBlocks: ['product_favorite_button', 'customer_favorites_list']
		}
	}
};
