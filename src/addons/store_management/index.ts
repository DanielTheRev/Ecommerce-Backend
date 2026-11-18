import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const storeManagementAddon: AddonModule = {
	manifest: {
		id: 'store_management',
		aliases: ['team_management', 'inventory_management'],
		name: 'Stock, Costos & Equipo',
		shortDescription: 'Control de inventario, costos de reposición, precios y gestión de empleados.',
		category: 'operaciones',
		icon: 'inventory_2',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: false,
		monthlyPriceARS: 0,
		surfaces: ['admin_module'],
		grantsCapabilities: ['hasStockAndCostControl', 'hasTeamManagement'],
		requiresSetup: false,
		targets: {
			domains: ['inventory'],
			adminScreens: ['inventory/stock', 'settings/costs', 'settings/team']
		}
	}
};
