import { EmployeePermission } from '@/interfaces/permission.interface';
import { normalizeActiveAddons } from '@/addons/registry';

export interface PermissionOptionItem {
	key: EmployeePermission;
	label: string;
	description: string;
	sensitive?: boolean;
}

export interface PermissionSectionGroup {
	sectionKey: string;
	addonIds: string[];
	title: string;
	description: string;
	permissions: PermissionOptionItem[];
}

const PERMISSION_SECTIONS: PermissionSectionGroup[] = [
	{
		sectionKey: 'pos',
		addonIds: ['pos'],
		title: 'Mostrador (POS)',
		description: 'Permisos de atención y cobro presencial en caja.',
		permissions: [
			{ key: 'pos:access', label: 'Acceder al Mostrador POS', description: 'Permite abrir la pantalla de venta rápida.' },
			{ key: 'pos:checkout', label: 'Cobrar Ventas', description: 'Permite cerrar operaciones y emitir tickets.' },
			{ key: 'pos:manual_discount', label: 'Aplicar Descuentos Manuales', description: 'Permite hacer quitas manuales sobre el total.', sensitive: true }
		]
	},
	{
		sectionKey: 'cash_register',
		addonIds: ['cash_register'],
		title: 'Caja Registradora',
		description: 'Control de turnos, arqueo y movimientos de efectivo.',
		permissions: [
			{ key: 'cash:open_close', label: 'Abrir y Cerrar Turno', description: 'Permite declarar fondo inicial y cerrar caja.' },
			{ key: 'cash:movements', label: 'Registrar Retiros / Gastos', description: 'Permite cargar ingresos o egresos menores en efectivo.' },
			{ key: 'cash:view_history', label: 'Ver Cierres Históricos', description: 'Permite consultar cierres de turnos anteriores.', sensitive: true }
		]
	},
	{
		sectionKey: 'sales_and_analytics',
		addonIds: ['sales_control', 'daily_summary'],
		title: 'Ventas & Resumen Diario',
		description: 'Consulta de operaciones cerradas y métricas del día.',
		permissions: [
			{ key: 'sales:view', label: 'Ver Historial de Ventas', description: 'Permite consultar tickets y comprobantes emitidos.' },
			{ key: 'sales:cancel', label: 'Anular Ventas', description: 'Permite cancelar una venta ya cerrada.', sensitive: true },
			{ key: 'analytics:daily_summary', label: 'Ver Resumen Diario', description: 'Permite ver totales del día y medios de pago.', sensitive: true }
		]
	},
	{
		sectionKey: 'catalog',
		addonIds: ['store_management', 'category_manager'],
		title: 'Productos, Stock & Categorías',
		description: 'Lectura y edición del catálogo e inventario.',
		permissions: [
			{ key: 'products:read_prices', label: 'Ver Productos y Precios de Venta', description: 'Consulta de precios y stock en salón sin ver costos.' },
			{ key: 'products:adjust_stock', label: 'Ajustar Stock', description: 'Permite modificar cantidades de inventario.' },
			{ key: 'products:create_edit', label: 'Crear y Editar Productos', description: 'Permite crear artículos nuevos y cambiar precios.', sensitive: true },
			{ key: 'products:view_costs', label: 'Ver Costos y Ganancias', description: 'Muestra costo de reposición y margen real.', sensitive: true },
			{ key: 'categories:manage', label: 'Administrar Categorías y Marcas', description: 'Permite crear o editar categorías del catálogo.' }
		]
	},
	{
		sectionKey: 'online_orders',
		addonIds: ['online_orders'],
		title: 'Pedidos Online',
		description: 'Gestión de pedidos web/WhatsApp y transferencias.',
		permissions: [
			{ key: 'orders:manage', label: 'Gestionar Pedidos Online', description: 'Atender órdenes, cambiar estados de envío y aprobar transferencias.' }
		]
	},
	{
		sectionKey: 'customers',
		addonIds: ['customer_accounts'],
		title: 'Clientes & Cuentas Corrientes',
		description: 'Padrón de compradores y saldos a cuenta.',
		permissions: [
			{ key: 'customers:read', label: 'Consultar Clientes y Fiados', description: 'Ver saldos y datos básicos de clientes.' },
			{ key: 'customers:manage', label: 'Crear y Editar Clientes', description: 'Dar de alta clientes y modificar límites de crédito.', sensitive: true }
		]
	},
	{
		sectionKey: 'suppliers',
		addonIds: ['suppliers'],
		title: 'Proveedores',
		description: 'Agenda de proveedores y costos de compra.',
		permissions: [
			{ key: 'suppliers:manage', label: 'Gestionar Proveedores', description: 'Ver y cargar proveedores o compras.', sensitive: true }
		]
	},
	{
		sectionKey: 'marketing',
		addonIds: ['coupons', 'marketing_banners', 'home_layout', 'newsletter', 'email_studio'],
		title: 'Marketing & Tienda Web',
		description: 'Cupones, banners, portada y campañas.',
		permissions: [
			{ key: 'marketing:manage', label: 'Administrar Marketing y Portada', description: 'Editar cupones, banners, hero sliders y diseño web.', sensitive: true }
		]
	},
	{
		sectionKey: 'fiscal_and_settings',
		addonIds: ['fiscal_audit', 'arca_invoicing', 'store_identity', 'store_management'],
		title: 'Administración, Fiscal & Equipo',
		description: 'Áreas sensibles reservadas normalmente al dueño.',
		permissions: [
			{ key: 'fiscal:manage', label: 'Facturación ARCA & Fiscal', description: 'Acceso a facturación electrónica y arqueo fiscal.', sensitive: true },
			{ key: 'settings:manage', label: 'Ajustes de Tienda', description: 'Modificar datos, medios de pago y configuración general.', sensitive: true },
			{ key: 'staff:manage', label: 'Gestionar Equipo y Permisos', description: 'Crear, suspender o editar empleados.', sensitive: true }
		]
	}
];

/**
 * Devuelve únicamente las secciones y permisos aplicables a los addons activos del comercio.
 */
export function buildPermissionCatalogForAddons(activeAddons: readonly string[] = []): PermissionSectionGroup[] {
	const activeSet = new Set(normalizeActiveAddons(activeAddons));
	return PERMISSION_SECTIONS
		.filter((section) => section.addonIds.some((id) => activeSet.has(id)))
		.map((section) => {
			if (section.sectionKey !== 'sales_and_analytics') {
				return section;
			}
			const filteredPermissions = section.permissions.filter((perm) => {
				if (perm.key === 'analytics:daily_summary') return activeSet.has('daily_summary');
				return activeSet.has('sales_control');
			});
			return { ...section, permissions: filteredPermissions };
		})
		.filter((section) => section.permissions.length > 0);
}
