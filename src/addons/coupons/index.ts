import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const couponsSettingsSchema = z.object({
	allowCouponsInPos: z.boolean().default(true),
	allowCouponsInStorefront: z.boolean().default(true),
	allowFirstPurchaseDiscount: z.boolean().default(true)
});

export const couponsAddon: AddonModule = {
	manifest: {
		id: 'coupons',
		aliases: ['discount_coupons', 'promocodes'],
		name: 'Cupones de Descuento & 1ra Compra',
		shortDescription: 'Códigos promocionales por porcentaje o monto fijo, límites de uso, vigencia y descuento automático de primera compra.',
		category: 'marketing',
		icon: 'confirmation_number',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_module', 'pos', 'storefront_section'],
		grantsCapabilities: ['hasCoupons'],
		requiresSetup: false,
		settingsRoute: '/marketing/coupons',
		settingsSchema: couponsSettingsSchema,
		configurableLabels: [
			{
				key: 'couponsModuleTitle',
				label: 'Título de Cupones de Descuento',
				description: 'Encabezado de la pantalla de administración de cupones.',
				defaultValue: 'Cupones & Descuentos Promocionales',
				surface: 'admin_module'
			}
		],
		configurableSettings: [
			{
				key: 'allowCouponsInPos',
				label: 'Permitir aplicar cupones en Mostrador POS',
				description: 'Habilita el campo de código promocional al cobrar en el local.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'allowCouponsInStorefront',
				label: 'Permitir aplicar cupones en Catálogo / Tienda Web',
				description: 'Muestra el campo "¿Tenés un cupón?" en el carrito y checkout online.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'allowFirstPurchaseDiscount',
				label: 'Habilitar beneficio automático de Primera Compra',
				description: 'Permite configurar un porcentaje de descuento para el primer pedido de cada cliente.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['checkout', 'pos'],
			adminScreens: ['marketing/coupons'],
			storefrontBlocks: ['checkout_coupon_input', 'first_purchase_banner']
		}
	}
};
