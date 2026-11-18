import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const homeLayoutSettingsSchema = z.object({
	enableHeroSection: z.boolean().default(true),
	enableTrustBarSection: z.boolean().default(true),
	enableNewsSection: z.boolean().default(true),
	enableCategoriesSection: z.boolean().default(true),
	enableMostSalesSection: z.boolean().default(true),
	enableTestimonialsSection: z.boolean().default(false)
});

export const homeLayoutAddon: AddonModule = {
	manifest: {
		id: 'home_layout',
		aliases: ['home_builder', 'home_sections'],
		name: 'Diseño de Portada (Home Builder)',
		shortDescription: 'Configuración de orden, títulos y visibilidad de bloques en la portada (Hero, Novedades, Más Vendidos, Categorías, Trust Bar y Testimonios).',
		category: 'web_storefront',
		icon: 'dashboard_customize',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4000,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasHomeLayoutBuilder'],
		requiresSetup: false,
		settingsRoute: '/home/home-layout',
		settingsSchema: homeLayoutSettingsSchema,
		configurableLabels: [
			{
				key: 'homeBuilderTitle',
				label: 'Título de Diseño de Portada',
				description: 'Encabezado de la pantalla de armado de secciones del Home.',
				defaultValue: 'Diseño & Secciones de Portada',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableHeroSection',
				label: 'Habilitar sección Hero / Portada',
				description: 'Muestra el banner o carrusel principal al inicio de la tienda.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableTrustBarSection',
				label: 'Habilitar Barra de Confianza (Envíos, Cuotas, Seguridad)',
				description: 'Muestra los íconos informativos de beneficios debajo del Hero.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableNewsSection',
				label: 'Habilitar sección Novedades / Destacados',
				description: 'Muestra los productos marcados como destacados en portada.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableCategoriesSection',
				label: 'Habilitar grilla de Categorías en Home',
				description: 'Muestra accesos directos visuales a las categorías principales.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableMostSalesSection',
				label: 'Habilitar sección Más Vendidos',
				description: 'Muestra el ranking de productos con mayor rotación.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableTestimonialsSection',
				label: 'Habilitar sección Reseñas / Testimonios',
				description: 'Muestra opiniones destacadas de clientes en la portada.',
				type: 'boolean',
				defaultValue: false
			}
		],
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['settings/home-layout', 'marketing/home'],
			storefrontBlocks: [
				'home_hero',
				'home_trust_bar',
				'home_news',
				'home_categories',
				'home_most_sales',
				'home_testimonials'
			]
		}
	}
};
