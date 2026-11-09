/**
 * ============================================================================
 * INTERFACES OFICIALES DE PLANES Y CAPACIDADES - VEXX
 * Directorio: src/interfaces/plan.interface.ts
 * ============================================================================
 */

export enum VexxPlanTier {
	LOCAL = 'local',
	POINT = 'point',
	PRO = 'pro'
}

export interface PlanLimits {
	/** Límite base de empleados permitidos en el plan */
	baseEmployees: number;
	/** Cantidad máxima de productos (-1 para ilimitado) */
	maxProducts: number;
}

export interface PlanCapabilities {
	// Operación Local Físico (Capa 1)
	hasPos: boolean;
	hasCashRegister: boolean;
	hasStockAndCostControl: boolean;
	hasScaleWeightPricing: boolean;
	hasCustomerAccounts: boolean;
	hasSupplierPurchases: boolean;
	hasTeamManagement: boolean;
	hasArcaBilling: boolean;
	hasInStorePaymentConfig: boolean;

	// Catálogo Digital & Pedidos (Capa 2)
	hasWebCatalog: boolean;
	hasOnlineOrders: boolean;
	hasThemeTemplates: boolean;
	hasCoupons: boolean;
	hasLocalDeliveryAndTakeaway: boolean;
	hasFeaturedProducts: boolean;
	hasStoreHoursAndStatus: boolean;
	hasSocialLinks: boolean;

	// Omnicanal & Tienda Web Completa (Capa 3)
	hasFullWebStore: boolean;
	hasCustomDomain: boolean;
	hasMarketingBanners: boolean;
	hasShopTheLook: boolean;
	hasOnlinePaymentGateways: boolean;
	hasAutomatedShippingCouriers: boolean;
	hasProductFeeds: boolean;
}
