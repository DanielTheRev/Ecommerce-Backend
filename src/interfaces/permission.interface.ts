/**
 * ============================================================================
 * INTERFACES DE PERMISOS GRANULARES Y PERFILES DE ROL - VEXX
 * Directorio: src/interfaces/permission.interface.ts
 * ============================================================================
 */

import { Document, Types } from 'mongoose';

/**
 * Llaves de permisos atómicos que puede tener un empleado en la tienda.
 */
export type EmployeePermission =
	// Mostrador & Ventas (POS)
	| 'pos:access'              // Abrir pantalla de mostrador POS
	| 'pos:checkout'            // Cobrar ventas y emitir tickets
	| 'pos:manual_discount'     // Aplicar descuentos manuales

	// Caja Registradora & Turnos
	| 'cash:open_close'         // Abrir turno y hacer arqueo ciego
	| 'cash:movements'          // Registrar egresos y gastos menores
	| 'cash:view_history'       // Ver cierres de caja históricos

	// Catálogo, Stock & Precios
	| 'products:read_prices'    // Consultar precios y stock en salón (sin costos)
	| 'products:adjust_stock'   // Modificar o corregir cantidades de stock
	| 'products:create_edit'    // Crear o editar productos y precios de venta
	| 'products:view_costs'     // Ver costo de compra y margen de ganancia

	// Pedidos Online (Capa 2 / 3)
	| 'orders:manage'           // Atender bandeja de pedidos web/WhatsApp

	// Clientes & Fiados
	| 'customers:read'          // Consultar saldo de cuenta corriente / fiados
	| 'customers:manage'        // Crear o editar clientes

	// Proveedores & Compras
	| 'suppliers:manage';       // Cargar compras y remitos de mercadería

/**
 * Entidad de Perfil de Rol / Alias creado por el comerciante.
 * Ej: "Chicos de Caja", "Encargado de Salón", "Repositor".
 */
export interface IRoleProfile {
	_id: string | Types.ObjectId;
	name: string;
	description?: string;
	permissions: EmployeePermission[];
	isDefault?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface IRoleProfileDocument extends Document, Omit<IRoleProfile, '_id'> {
	_id: Types.ObjectId;
}

/**
 * Perfiles sugeridos de fábrica para acelerar la configuración del comerciante.
 */
export const DEFAULT_ROLE_PROFILES: Omit<IRoleProfile, '_id' | 'createdAt' | 'updatedAt'>[] = [
	{
		name: 'Cajero Mostrador',
		description: 'Venta ágil en mostrador, cobros, arqueo ciego y consulta de clientes.',
		permissions: [
			'pos:access',
			'pos:checkout',
			'cash:open_close',
			'cash:movements',
			'customers:read',
			'products:read_prices'
		],
		isDefault: true
	},
	{
		name: 'Vendedor de Salón',
		description: 'Atención al cliente, consulta de stock y armado de carritos.',
		permissions: [
			'pos:access',
			'products:read_prices',
			'customers:read'
		],
		isDefault: true
	},
	{
		name: 'Repositor / Depósito',
		description: 'Control de inventario, recepción de mercadería y ajuste de stock.',
		permissions: [
			'products:read_prices',
			'products:adjust_stock',
			'suppliers:manage'
		],
		isDefault: true
	},
	{
		name: 'Encargado de Turno',
		description: 'Supervisión completa del mostrador, cajas, precios y pedidos.',
		permissions: [
			'pos:access',
			'pos:checkout',
			'pos:manual_discount',
			'cash:open_close',
			'cash:movements',
			'cash:view_history',
			'products:read_prices',
			'products:adjust_stock',
			'products:create_edit',
			'orders:manage',
			'customers:manage'
		],
		isDefault: true
	}
];
