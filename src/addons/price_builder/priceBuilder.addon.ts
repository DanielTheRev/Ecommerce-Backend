import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const priceBuilderAddon: AddonModule = {
	manifest: {
		id: 'price_builder',
		aliases: ['installments_cft', 'pricing_pro'],
		name: 'Price Builder — Creador de Precios',
		shortDescription:
			'Motor de precios por canal (Efectivo, Transferencia, QR, Débito, 1 Pago, Lista), tasas por superficie y simulador de ganancia neta.',
		category: 'producto',
		icon: 'credit_score',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_form', 'pos', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		targets: {
			domains: ['product_form', 'product_pricing', 'storefront_prices', 'checkout', 'pos'],
			productFormSlots: [{ slot: 'pricing', mode: 'replace', componentKey: 'price_builder_pipeline' }],
			adminScreens: ['settings/pricing', 'settings/payments'],
			storefrontBlocks: ['price_display_summary', 'installments_badge'],
			interactions: [
				{ target: 'shipping', behavior: 'Emite SHIPPING_SUBSIDY_INFO y calcula shippingSubsidy solo si hay un costo con category=shipping.' },
				{ target: 'checkout', behavior: 'Bloquea tarjeta o cuotas sin interés según paymentRestrictions del producto/carrito.' }
			]
		}
	}
};
