import { ProductType } from '@/interfaces/product.interface';

/**
 * Matriz de Capacidades y Funcionalidades por Vertical Comercial.
 * Define qué módulos, vistas y validaciones corresponden a cada rubro.
 */
export interface VerticalCapabilities {
	businessType: string;
	label: string;
	hasShopTheLook: boolean;
	hasClothingSizesAndFits: boolean;
	hasSizeGuide: boolean;
	hasOutfitsCombineWith: boolean;
	hasMasterBarcodeCatalog: boolean; // Catálogo global EAN-13 para Kioscos / Almacenes
	hasWeightScalePricing: boolean;    // Venta fraccionada por peso (Kg, g, Litro)
	hasTechSpecifications: boolean;    // Atributos de tecnología (RAM, Storage, CPU)
	hasQuickPosCheckout: boolean;      // Terminal POS con lector de código de barras
	hasBeautyAromas: boolean;          // Perfumería / Cosmética
	allowedProductTypes: string[];     // Tipos de producto permitidos en el discriminador de Mongoose
}

export const VERTICAL_CAPABILITIES: Record<string, VerticalCapabilities> = {
	fashion: {
		businessType: 'fashion',
		label: 'Moda e Indumentaria',
		hasShopTheLook: true,
		hasClothingSizesAndFits: true,
		hasSizeGuide: true,
		hasOutfitsCombineWith: true,
		hasMasterBarcodeCatalog: false,
		hasWeightScalePricing: false,
		hasTechSpecifications: false,
		hasQuickPosCheckout: true,
		hasBeautyAromas: false,
		allowedProductTypes: [ProductType.CLOTHING]
	},
	kiosk_grocery: {
		businessType: 'kiosk_grocery',
		label: 'Kiosco y Almacén',
		hasShopTheLook: false,
		hasClothingSizesAndFits: false,
		hasSizeGuide: false,
		hasOutfitsCombineWith: false,
		hasMasterBarcodeCatalog: true,
		hasWeightScalePricing: true,
		hasTechSpecifications: false,
		hasQuickPosCheckout: true,
		hasBeautyAromas: false,
		allowedProductTypes: [ProductType.GENERAL]
	},
	tech_electronics: {
		businessType: 'tech_electronics',
		label: 'Tecnología y Electrónica',
		hasShopTheLook: false,
		hasClothingSizesAndFits: false,
		hasSizeGuide: false,
		hasOutfitsCombineWith: false,
		hasMasterBarcodeCatalog: false,
		hasWeightScalePricing: false,
		hasTechSpecifications: true,
		hasQuickPosCheckout: true,
		hasBeautyAromas: false,
		allowedProductTypes: [ProductType.TECH, ProductType.GENERAL]
	},
	butcher: {
		businessType: 'butcher',
		label: 'Carnicería / Granja',
		hasShopTheLook: false,
		hasClothingSizesAndFits: false,
		hasSizeGuide: false,
		hasOutfitsCombineWith: false,
		hasMasterBarcodeCatalog: true,
		hasWeightScalePricing: true,
		hasTechSpecifications: false,
		hasQuickPosCheckout: true,
		hasBeautyAromas: false,
		allowedProductTypes: [ProductType.GENERAL]
	},
	bakery: {
		businessType: 'bakery',
		label: 'Panadería / Confitería',
		hasShopTheLook: false,
		hasClothingSizesAndFits: false,
		hasSizeGuide: false,
		hasOutfitsCombineWith: false,
		hasMasterBarcodeCatalog: true,
		hasWeightScalePricing: true,
		hasTechSpecifications: false,
		hasQuickPosCheckout: true,
		hasBeautyAromas: false,
		allowedProductTypes: [ProductType.GENERAL]
	},
	gastronomy: {
		businessType: 'gastronomy',
		label: 'Gastronomía y Bebidas',
		hasShopTheLook: false,
		hasClothingSizesAndFits: false,
		hasSizeGuide: false,
		hasOutfitsCombineWith: false,
		hasMasterBarcodeCatalog: true,
		hasWeightScalePricing: true,
		hasTechSpecifications: false,
		hasQuickPosCheckout: true,
		hasBeautyAromas: false,
		allowedProductTypes: [ProductType.GENERAL]
	}
};

/**
 * Obtiene las capacidades del comercio según su rubro configurado.
 * Si el rubro no existe, utiliza 'kiosk_grocery' como rubro por defecto.
 */
export function getVerticalCapabilities(businessType?: string): VerticalCapabilities {
	const normalized = (businessType || '').trim().toLowerCase();
	return VERTICAL_CAPABILITIES[normalized] || VERTICAL_CAPABILITIES.kiosk_grocery;
}

/**
 * Comprueba si una funcionalidad específica está habilitada para el rubro dado.
 */
export function isFeatureAllowed(
	businessType: string | undefined,
	feature: keyof Omit<VerticalCapabilities, 'businessType' | 'label' | 'allowedProductTypes'>
): boolean {
	const caps = getVerticalCapabilities(businessType);
	return !!caps[feature];
}

/**
 * Valida si un tipo de producto Mongoose está permitido para el rubro comercial.
 */
export function isProductTypeAllowed(businessType: string | undefined, productType: string): boolean {
	const caps = getVerticalCapabilities(businessType);
	return caps.allowedProductTypes.includes(productType);
}

/**
 * Retorna la lista de tipos de producto admitidos para el rubro.
 */
export function getAllowedProductTypes(businessType?: string): string[] {
	return getVerticalCapabilities(businessType).allowedProductTypes;
}
