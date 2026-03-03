export interface IVariantAttribute {
	key: string;
	value: string;
}

export interface IVariantColor {
	name: string;
	hex: string;
}

export interface IVariant {
	sku: string;
	attributes: IVariantAttribute[];
	color?: IVariantColor;
	stock: number;
	reservedStock: number;
	isActive: boolean;
	images: { url: string; public_id: string }[];
	barcode?: string;
}
