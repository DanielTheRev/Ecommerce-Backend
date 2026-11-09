/**
 * ============================================================================
 * ARCHIVO EN MODO SOLO LECTURA / REFERENCIA HISTÓRICA PARA IDEACIÓN
 * ============================================================================
 * NOTA: Este archivo NO es utilizado en runtime por ningún módulo activo.
 * Toda la lógica de capacidades efectivas y validaciones fue migrada y
 * unificada de forma tipada en: src/config/planCapabilities.ts
 * Se conserva vivo a pedido del usuario para consulta de ideas de producto.
 * ============================================================================
 */

import { ProductType } from '@/interfaces/product.interface';
import { BusinessType } from '@/interfaces/tenant.interface';

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
	[BusinessType.FASHION]: {
		businessType: BusinessType.FASHION,
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
	[BusinessType.KIOSK_GROCERY]: {
		businessType: BusinessType.KIOSK_GROCERY,
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
		allowedProductTypes: [ProductType.KIOSK]
	},
	[BusinessType.TECH_ELECTRONICS]: {
		businessType: BusinessType.TECH_ELECTRONICS,
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
		allowedProductTypes: [ProductType.TECH, ProductType.KIOSK]
	},
	[BusinessType.BUTCHER]: {
		businessType: BusinessType.BUTCHER,
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
		allowedProductTypes: [ProductType.KIOSK]
	},
	[BusinessType.BAKERY]: {
		businessType: BusinessType.BAKERY,
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
		allowedProductTypes: [ProductType.KIOSK]
	},
	[BusinessType.GASTRONOMY]: {
		businessType: BusinessType.GASTRONOMY,
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
		allowedProductTypes: [ProductType.KIOSK]
	}
};

/**
 * Obtiene las capacidades del comercio según su rubro configurado.
 * Falla de forma explícita si el rubro no está definido o no es válido (cero fallbacks silenciosos).
 */
export function getVerticalCapabilities(businessType?: string): VerticalCapabilities {
	if (!businessType || !businessType.trim()) {
		throw new Error('El rubro comercial (businessType) es obligatorio para determinar las capacidades del comercio.');
	}
	const normalized = businessType.trim().toLowerCase();
	const caps = VERTICAL_CAPABILITIES[normalized];
	if (!caps) {
		throw new Error(`Rubro comercial '${businessType}' no reconocido en el sistema. Rubros válidos: ${Object.keys(VERTICAL_CAPABILITIES).join(', ')}`);
	}
	return caps;
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
