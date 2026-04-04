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
	color?: IVariantColor;
	stock: number;
	reservedStock: number;
	isActive: boolean;
	imageReference?: { url: string; public_id: string };
	barcode?: string;
}

// Vura (ClothingProduct) — talle obligatorio
export interface IClothingVariant extends IBaseVariant {
	size: string;
}

// Electromix (TechProduct) — atributos flexibles obligatorios
export interface ITechVariant extends IBaseVariant {
	attributes: IVariantAttribute[];
}

// Union type para contextos donde no se discrimina el tipo
export type IVariant = IClothingVariant | ITechVariant;
