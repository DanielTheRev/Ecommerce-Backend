/**
 * ============================================================================
 * MATRIZ CENTRAL DE CAPACIDADES DE PLANES - VEXX
 * Directorio: src/config/planCapabilities.ts
 * ============================================================================
 */

import { VexxPlanTier, PlanCapabilities, PlanLimits } from '@/interfaces/plan.interface';
import { BusinessType } from '@/interfaces/tenant.interface';
import { ProductType } from '@/interfaces/product.interface';
import { AppError } from '@/errors/app.error';


// ============================================================================
// ARQUITECTURA POO DE CAPACIDADES: CATÁLOGO BASE + HERENCIA + SINGLETONS
// ============================================================================

/**
 * Catálogo Base de Capacidades de Vexx.
 * Todas las banderas inician en false por defecto.
 * Nadie fuera de este archivo puede instanciarla (clase abstracta privada).
 */
abstract class BaseVexxCapabilities implements PlanCapabilities {
	/** Límites oficiales del plan (empleados, productos, etc.) */
	abstract readonly limits: PlanLimits;

	// Operación Local Físico (Capa 1)
	hasPos = false;
	hasCashRegister = false;
	hasStockAndCostControl = false;
	hasScaleWeightPricing = false;
	hasCustomerAccounts = false;
	hasSupplierPurchases = false;
	hasTeamManagement = false;
	hasArcaBilling = false;
	hasInStorePaymentConfig = false;

	// Catálogo Digital & Pedidos (Capa 2)
	hasWebCatalog = false;
	hasOnlineOrders = false;
	hasThemeTemplates = false;
	hasCoupons = false;
	hasLocalDeliveryAndTakeaway = false;
	hasFeaturedProducts = false;
	hasStoreHoursAndStatus = false;
	hasSocialLinks = false;

	// Omnicanal & Tienda Web Completa (Capa 3)
	hasFullWebStore = false;
	hasCustomDomain = false;
	hasMarketingBanners = false;
	hasShopTheLook = false;
	hasOnlinePaymentGateways = false;
	hasAutomatedShippingCouriers = false;
	hasProductFeeds = false;
}

/**
 * Plan Vexx Local: Operación de Local Físico & Gestión Mostrador
 * Constructor protegido para permitir herencia a planes superiores, bloqueando instanciación externa.
 */
class VexxLocalCapabilities extends BaseVexxCapabilities {
	private static _localInstance: VexxLocalCapabilities;

	readonly limits: PlanLimits = Object.freeze({
		baseEmployees: 10,
		maxProducts: -1 // Ilimitado
	});

	protected constructor() {
		super();
		// Habilita paquete físico completo:
		this.hasPos = true;
		this.hasCashRegister = true;
		this.hasStockAndCostControl = true;
		this.hasScaleWeightPricing = true;
		this.hasCustomerAccounts = true;
		this.hasSupplierPurchases = true;
		this.hasTeamManagement = true;
		this.hasArcaBilling = true;
		this.hasInStorePaymentConfig = true;
		this.hasCoupons = true;
	}

	public static getInstance(): Readonly<VexxLocalCapabilities> {
		if (!this._localInstance) {
			this._localInstance = Object.freeze(new VexxLocalCapabilities());
		}
		return this._localInstance;
	}
}

/**
 * Plan Vexx Point: Local Físico + Catálogo Online & Pedidos
 * Hereda todas las capacidades físicas y los límites de Local automáticamente.
 * Constructor protegido para permitir herencia a Pro, bloqueando instanciación externa.
 */
class VexxPointCapabilities extends VexxLocalCapabilities {
	private static _pointInstance: VexxPointCapabilities;

	// Hereda automáticamente limits de Local: { baseEmployees: 10, maxProducts: -1 }

	protected constructor() {
		super(); // Hereda automáticamente todo lo de Local
		// Habilita catálogo digital y pedidos online:
		this.hasWebCatalog = true;
		this.hasOnlineOrders = true;
		this.hasThemeTemplates = true;
		this.hasLocalDeliveryAndTakeaway = true;
		this.hasFeaturedProducts = true;
		this.hasStoreHoursAndStatus = true;
		this.hasSocialLinks = true;
	}

	public static getInstance(): Readonly<VexxPointCapabilities> {
		if (!this._pointInstance) {
			this._pointInstance = Object.freeze(new VexxPointCapabilities());
		}
		return this._pointInstance;
	}
}

/**
 * Plan Vexx Pro: Omnicanal Completo (Físico + Catálogo + Tienda Web Completa)
 * Hereda todas las capacidades de Point (físico + catálogo) automáticamente.
 * Terminal de la jerarquía: constructor privado estricto e inmutable.
 */
class VexxProCapabilities extends VexxPointCapabilities {
	private static _proInstance: VexxProCapabilities;

	override readonly limits: PlanLimits = Object.freeze({
		baseEmployees: 25,
		maxProducts: -1 // Ilimitado
	});

	private constructor() {
		super(); // Hereda automáticamente todo lo de Point y Local
		// Habilita suite avanzada de ecommerce y omnicanalidad:
		this.hasFullWebStore = true;
		this.hasCustomDomain = true;
		this.hasMarketingBanners = true;
		this.hasShopTheLook = true;
		this.hasOnlinePaymentGateways = true;
		this.hasAutomatedShippingCouriers = true;
		this.hasProductFeeds = true;
	}

	public static getInstance(): Readonly<VexxProCapabilities> {
		if (!this._proInstance) {
			this._proInstance = Object.freeze(new VexxProCapabilities());
		}
		return this._proInstance;
	}
}

// ============================================================================
// RESOLUCIÓN CENTRAL DE CAPACIDADES POR PLAN (SINGLETON DIRECTO)
// ============================================================================

/**
 * Obtiene las capacidades del plan de forma segura consultando directamente al Singleton correspondiente.
 * Lanza un AppError explícito si el plan no es válido (Fail Fast).
 */
export function getPlanCapabilities(planTier?: string): PlanCapabilities {
	if (!planTier || !planTier.trim()) {
		throw new AppError(
			'Plan tier required',
			'El comercio no tiene un plan de suscripción asignado en la plataforma.',
			500
		);
	}
	const normalized = planTier.trim().toLowerCase() as VexxPlanTier;
	switch (normalized) {
		case VexxPlanTier.LOCAL:
			return VexxLocalCapabilities.getInstance();
		case VexxPlanTier.POINT:
			return VexxPointCapabilities.getInstance();
		case VexxPlanTier.PRO:
			return VexxProCapabilities.getInstance();
		default:
			throw new AppError(
				'Invalid plan tier',
				`El plan '${planTier}' no es reconocido. Planes válidos: ${Object.values(VexxPlanTier).join(', ')}`,
				500
			);
	}
}

/**
 * Obtiene los límites oficiales del plan consultando directamente a su Singleton.
 * Lanza un AppError explícito si el plan no es válido (Fail Fast).
 */
export function getPlanLimits(planTier?: string): PlanLimits {
	if (!planTier || !planTier.trim()) {
		throw new AppError(
			'Plan tier required',
			'El plan de suscripción (planTier) es obligatorio para determinar límites de empleados.',
			500
		);
	}
	const normalized = planTier.trim().toLowerCase() as VexxPlanTier;
	switch (normalized) {
		case VexxPlanTier.LOCAL:
			return VexxLocalCapabilities.getInstance().limits;
		case VexxPlanTier.POINT:
			return VexxPointCapabilities.getInstance().limits;
		case VexxPlanTier.PRO:
			return VexxProCapabilities.getInstance().limits;
		default:
			throw new AppError(
				'Invalid plan tier',
				`El plan '${planTier}' no es válido para determinar límites de empleados. Planes válidos: ${Object.values(VexxPlanTier).join(', ')}`,
				500
			);
	}
}

/**
 * Calcula la cantidad máxima de empleados permitidos para un comercio:
 * Límite Base del Plan + Cupos Extra Comprados ("Dinerito dinerito")
 */
export function getEffectiveMaxEmployees(planTier?: string, extraEmployeesPurchased: number = 0): number {
	const limits = getPlanLimits(planTier);
	const extras = Math.max(0, Number(extraEmployeesPurchased) || 0);
	return limits.baseEmployees + extras;
}

export interface BusinessVerticalOption {
	code: BusinessType;
	label: string;
	badge: string;
	description: string;
}

export const BUSINESS_VERTICAL_OPTIONS: BusinessVerticalOption[] = [
	{
		code: BusinessType.KIOSK_GROCERY,
		label: 'Kiosco / Maxikiosco / Almacén',
		badge: 'Mostrador, Balanza & Escáner',
		description: 'Venta rápida, códigos de barra EAN-13, golosinas, bebidas y fiambres'
	},
	{
		code: BusinessType.FASHION,
		label: 'Indumentaria & Calzado',
		badge: 'Moda Visual, Talles & Curvas',
		description: 'Ropa, calzado, curvas de talles, colores, fotos por variante y tienda online'
	},
	{
		code: BusinessType.TECH_ELECTRONICS,
		label: 'Tecnología & Celulares',
		badge: 'Garantías & N° de Serie',
		description: 'Celulares, computación, RAM, almacenamiento y garantías'
	},
	{
		code: BusinessType.BUTCHER,
		label: 'Carnicería & Granja',
		badge: 'Cortes por Kilo & Balanza',
		description: 'Venta fraccionada por peso ($/Kg), balanza en vivo y mostrador'
	},
	{
		code: BusinessType.BAKERY,
		label: 'Panadería & Confitería',
		badge: 'Pan por Peso & Docenas',
		description: 'Pan por kilo, facturas y empanadas por docena / unidad'
	},
	{
		code: BusinessType.GASTRONOMY,
		label: 'Gastronomía / Bar / Café',
		badge: 'Mesas, Mostrador & Cocina',
		description: 'Cafetería, minutas, platos, comandas de mostrador y delivery'
	}
];

export const BUSINESS_VERTICAL_PRODUCT_TYPES: Record<BusinessType, ProductType[]> = {
	[BusinessType.FASHION]: [ProductType.CLOTHING],
	[BusinessType.KIOSK_GROCERY]: [ProductType.KIOSK],
	[BusinessType.TECH_ELECTRONICS]: [ProductType.TECH, ProductType.KIOSK],
	[BusinessType.BUTCHER]: [ProductType.KIOSK],
	[BusinessType.BAKERY]: [ProductType.KIOSK],
	[BusinessType.GASTRONOMY]: [ProductType.KIOSK]
};

export function isProductTypeAllowed(businessType: string | undefined, productType: string): boolean {
	if (!businessType || !businessType.trim()) {
		throw new AppError('Business type required', 'El rubro comercial es obligatorio para validar productos.', 400);
	}
	const normalized = businessType.trim().toLowerCase() as BusinessType;
	const allowed = BUSINESS_VERTICAL_PRODUCT_TYPES[normalized];
	if (!allowed) {
		throw new AppError('Invalid business type', `El rubro '${businessType}' no es válido para productos.`, 400);
	}
	return allowed.includes(productType as ProductType);
}

export function getAllowedProductTypes(businessType?: string): ProductType[] {
	if (!businessType || !businessType.trim()) {
		throw new AppError('Business type required', 'El rubro comercial es obligatorio para obtener tipos de producto.', 400);
	}
	const normalized = businessType.trim().toLowerCase() as BusinessType;
	const allowed = BUSINESS_VERTICAL_PRODUCT_TYPES[normalized];
	if (!allowed) {
		throw new AppError('Invalid business type', `El rubro '${businessType}' no es válido.`, 400);
	}
	return allowed;
}

/**
 * ============================================================================
 * [EXTENSION-POINT: MATRIZ EXTENSIBLE DE CAPACIDADES EFECTIVAS - VEXX]
 * ============================================================================
 * Esta función es la ÚNICA FUENTE DE VERDAD de permisos y capacidades en el sistema.
 * Cruza de forma estricta (usando Enums tipados) el Plan Contratado con el Rubro
 * del Comercio, garantizando Fail Fast si algún valor es desconocido.
 * 
 * Para extender o agregar nuevas reglas condicionales en el futuro, hacelo aquí.
 * ============================================================================
 */
export function getEffectivePlanCapabilities(
	planTier?: string,
	businessType?: string
): PlanCapabilities {
	if (!planTier || !planTier.trim()) {
		throw new AppError('Plan tier required', 'El plan de suscripción (planTier) es obligatorio para evaluar capacidades.', 500);
	}
	if (!businessType || !businessType.trim()) {
		throw new AppError('Business type required', 'El rubro comercial (businessType) es obligatorio para evaluar capacidades.', 400);
	}

	const normalizedTier = planTier.trim().toLowerCase() as VexxPlanTier;
	if (!Object.values(VexxPlanTier).includes(normalizedTier)) {
		throw new AppError(
			'Invalid plan tier',
			`El plan '${planTier}' no es reconocido. Planes válidos: ${Object.values(VexxPlanTier).join(', ')}`,
			500
		);
	}

	const normalizedBusinessType = businessType.trim().toLowerCase() as BusinessType;
	if (!Object.values(BusinessType).includes(normalizedBusinessType)) {
		throw new AppError(
			'Invalid business type',
			`El rubro comercial '${businessType}' no es reconocido. Rubros válidos: ${Object.values(BusinessType).join(', ')}`,
			400
		);
	}

	// 1. Clonar las capacidades base del plan contratado
	const effective: PlanCapabilities = { ...getPlanCapabilities(normalizedTier) };

	// -------------------------------------------------------------------------
	// [EXTENSION-POINT]: Intersecciones de Negocio (Plan x Rubro)
	// -------------------------------------------------------------------------

	// Regla A: Shop The Look solo existe si el plan lo incluye Y el rubro es Moda / Indumentaria
	if (normalizedBusinessType !== BusinessType.FASHION) {
		effective.hasShopTheLook = false;
	}

	// Regla B: Balanza / Pesables solo existe si el rubro realmente fracciona por peso
	const weighableRubros: BusinessType[] = [
		BusinessType.KIOSK_GROCERY,
		BusinessType.BUTCHER,
		BusinessType.BAKERY,
		BusinessType.GASTRONOMY
	];
	if (!weighableRubros.includes(normalizedBusinessType)) {
		effective.hasScaleWeightPricing = false;
	}

	return effective;
}
