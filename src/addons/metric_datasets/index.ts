import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const metricDatasetsAddon: AddonModule = {
	manifest: {
		id: 'metric_datasets',
		name: 'Colecciones por Métricas en Tiempo Real',
		shortDescription: 'Rankings automáticos de más vendidos, más vistos y más agregados al carrito.',
		category: 'tracking',
		icon: 'trending_up',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4500,
		surfaces: ['admin_module', 'storefront_section'],
		grantsCapabilities: ['hasMetricDataSets'],
		requiresSetup: false,
		targets: {
			domains: ['storefront_prices'],
			adminScreens: ['products/datasets'],
			interactions: [
				{ target: 'data_sets', behavior: 'Desbloquea filtros por métricas en tiempo real (vistas, conversiones, ventas).' }
			]
		}
	}
};
