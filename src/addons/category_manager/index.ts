import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const categoryManagerSettingsSchema = z.object({
	enableHierarchicalCategoryGroups: z.boolean().default(true),
	enableBrandsCatalog: z.boolean().default(true),
	showCategoryProductCount: z.boolean().default(true)
});

export const categoryManagerAddon: AddonModule = {
	manifest: {
		id: 'category_manager',
		aliases: ['categories', 'category_groups'],
		name: 'Categorías, Rubros & Marcas',
		shortDescription: 'Organización de categorías simples, grupos jerárquicos de categorías con slug e íconos y catálogo de marcas.',
		category: 'producto',
		icon: 'category',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 2500,
		surfaces: ['admin_module', 'admin_form', 'storefront_section'],
		grantsCapabilities: ['hasCategoryManager'],
		requiresSetup: false,
		settingsRoute: '/products/categories',
		settingsSchema: categoryManagerSettingsSchema,
		configurableLabels: [
			{
				key: 'categoriesTitle',
				label: 'Título de Categorías',
				description: 'Nombre del módulo de categorías en el panel.',
				defaultValue: 'Categorías & Agrupaciones',
				surface: 'admin_module'
			},
			{
				key: 'brandsTitle',
				label: 'Título de Marcas',
				description: 'Nombre del listado de marcas en el panel.',
				defaultValue: 'Marcas',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'enableHierarchicalCategoryGroups',
				label: 'Habilitar Grupos Jerárquicos de Categorías',
				description: 'Permite agrupar subcategorías dentro de categorías madre para navegación en tienda y catálogo.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableBrandsCatalog',
				label: 'Habilitar gestión de Marcas',
				description: 'Permite administrar el listado oficial de marcas del comercio.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'showCategoryProductCount',
				label: 'Mostrar cantidad de productos por categoría',
				description: 'Exhibe el conteo de artículos activos en cada categoría.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form', 'inventory'],
			adminScreens: ['products/categories', 'settings/categories'],
			storefrontBlocks: ['category_navigation']
		}
	}
};
