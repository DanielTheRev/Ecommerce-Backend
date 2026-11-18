export interface IVariantColor {
	name: string;
	hex: string;
}

export interface IVariantAttribute {
	key: string;
	value: string;
}

// Campos compartidos por todos los tipos de variantes
export interface IBaseVariant {
	_id?: string;
	sku: string;
	/** Etiqueta legible auto-derivada o explícita para POS, tickets y carrito */
	label?: string;
	color?: IVariantColor;
	stock: number;
	reservedStock?: number;
	isActive: boolean;
	// [REMOVE-BEFORE-PROD]: legacy imageReference / imageIndex
	imageReference?: { url: string; public_id: string };
	imageIndex?: number;
	barcode?: string;
	/** Sobreescritura opcional de precio si difiere del precio base del producto */
	price?: number;
	/** Si es false, usa providerCost y profitMargin propios para calcular prices[] */
	inheritPrice?: boolean;
	providerCost?: number;
	profitMargin?: number;
	prices?: Record<string, any>;
	/** Talle (Indumentaria) o Medida/Presentación (Almacén, Carnicería, Ferretería) */
	size?: string;
	/** Capacidad líquida o peso fraccionado (ej: 750ml, 1L, 500g) */
	volume?: string;
	/** Atributos clave-valor libres (RAM, Almacenamiento, Material, etc.) */
	attributes?: IVariantAttribute[];
}

// Moda / Indumentaria (ClothingProduct) — talle obligatorio
export interface IClothingVariant extends IBaseVariant {
	size: string;
}

// Electromix (TechProduct) — atributos flexibles obligatorios
export interface ITechVariant extends IBaseVariant {
	attributes: IVariantAttribute[];
}

// Kiosco / Almacén / Mostrador (KioskProduct)
export interface IKioskVariant extends IBaseVariant {
	size?: string;
	volume?: string;
}

// Union type para contextos donde no se discrimina el tipo
export type IVariant = IClothingVariant | ITechVariant | IKioskVariant | IBaseVariant;
