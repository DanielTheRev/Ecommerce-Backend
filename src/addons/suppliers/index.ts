import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';

export const suppliersSettingsSchema = z.object({
	showProviderUrlInProduct: z.boolean().default(true),
	trackLastPurchaseCost: z.boolean().default(true)
});

export const suppliersAddon: AddonModule = {
	manifest: {
		id: 'suppliers',
		aliases: ['providers'],
		name: 'Proveedores & Compras',
		shortDescription: 'Agenda de proveedores, enlace directo al catálogo del proveedor en cada producto y costos de reposición.',
		category: 'operaciones',
		icon: 'local_shipping',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 3500,
		surfaces: ['admin_module', 'admin_form'],
		grantsCapabilities: ['hasSupplierPurchases'],
		requiresSetup: false,
		settingsRoute: '/home/providers',
		settingsSchema: suppliersSettingsSchema,
		configurableLabels: [
			{
				key: 'suppliersModuleTitle',
				label: 'Título del módulo de Proveedores',
				description: 'Encabezado de la pantalla de gestión de proveedores.',
				defaultValue: 'Proveedores & Listas de Costos',
				surface: 'admin_module'
			},
			{
				key: 'supplierFieldLabel',
				label: 'Label de Proveedor en Producto',
				description: 'Etiqueta del selector de proveedor dentro del formulario de producto.',
				defaultValue: 'Proveedor Asignado',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'showProviderUrlInProduct',
				label: 'Mostrar campo Enlace Web en Proveedor (providerUrl)',
				description: 'Permite guardar el link exacto del artículo en la web del mayorista/proveedor.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'trackLastPurchaseCost',
				label: 'Registrar historial de costos de reposición',
				description: 'Mantiene trazabilidad cuando cambia el costo de compra del proveedor.',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form', 'inventory'],
			productFormSlots: [{ slot: 'supplier', mode: 'extend', componentKey: 'supplier_selector' }],
			adminScreens: ['suppliers', 'purchases']
		}
	}
};
