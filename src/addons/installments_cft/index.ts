import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const installmentsCftAddon: AddonModule = {
	manifest: {
		id: 'installments_cft',
		aliases: ['pricing_pro'],
		name: 'Máquina de Precios, Cuotas & Canales',
		shortDescription: 'Precios diferenciados o vinculados por canal (efectivo, transferencia, débito, crédito), cuotas CFT y simulador de ganancia neta.',
		category: 'producto',
		icon: 'credit_score',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_form', 'pos', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false
	}
};
