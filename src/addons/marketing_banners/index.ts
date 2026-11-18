import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const marketingBannersSettingsSchema = z.object({
	enableHeroSliders: z.boolean().default(true),
	enablePromoBanners: z.boolean().default(true),
	enableBentoMenus: z.boolean().default(true),
	maxHeroSlides: z.coerce.number().int().min(1).max(15).default(6)
});

export const marketingBannersAddon: AddonModule = {
	manifest: {
		id: 'marketing_banners',
		aliases: ['hero_slider', 'bento_menus', 'banners'],
		name: 'Hero Sliders, Banners & Menús Bento',
		shortDescription: 'Gestión de carrusel Hero (imágenes duales Desktop/Mobile), banners promocionales y grillas visuales estilo Bento.',
		category: 'web_storefront',
		icon: 'view_carousel',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 5000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasMarketingBanners'],
		requiresSetup: false,
		settingsRoute: '/home/banners',
		settingsSchema: marketingBannersSettingsSchema,
		configurableLabels: [
			{
				key: 'heroSlidersTitle',
				label: 'Título de Hero Sliders',
				description: 'Encabezado del administrador de diapositivas principales de portada.',
				defaultValue: 'Hero Sliders de Portada',
				surface: 'admin_module'
			},
			{
				key: 'bentoMenusTitle',
				label: 'Título de Menús Visuales Bento',
				description: 'Encabezado del editor de grillas visuales interactivas.',
				defaultValue: 'Menús Visuales & Grillas Bento',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableHeroSliders',
				label: 'Habilitar Hero Sliders (/api/hero)',
				description: 'Permite crear sliders principales con doble imagen Desktop y Mobile.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enablePromoBanners',
				label: 'Habilitar Banners Promocionales (/api/home/banners)',
				description: 'Permite administrar banners de campañas y anuncios intermedios.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableBentoMenus',
				label: 'Habilitar Menús Visuales / Bento Grid (/api/menus)',
				description: 'Permite armar mosaicos visuales de colecciones o categorías estilo Bento.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'maxHeroSlides',
				label: 'Cantidad máxima de slides activos en el Hero',
				description: 'Límite de diapositivas simultáneas para cuidar la velocidad de carga.',
				type: 'number',
				defaultValue: 6
			}
		],
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['marketing/banners', 'marketing/hero', 'marketing/bento-menus'],
			storefrontBlocks: ['hero_slider', 'promo_banners', 'bento_banners']
		}
	}
};
