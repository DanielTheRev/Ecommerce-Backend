import { Document, Types } from 'mongoose';
import { IProductDocument } from './product.interface';

export interface IProductBundleItem {
	_id?: Types.ObjectId | string;
	product: Types.ObjectId | IProductDocument | string;
	variantSku?: string;
	quantity: number;
}

export interface IProductBundleImage {
	url: string;
	public_id?: string;
	isMain: boolean;
	source?: 'uploaded' | 'inherited';
}

export interface IProductBundle {
	_id?: Types.ObjectId | string;
	name: string;
	slug: string;
	description?: string;
	category?: string;
	tags?: string[];
	items: IProductBundleItem[];

	// Precios y Rentabilidad Financiera en Vivo
	pricingType: 'custom' | 'sum_inherited';
	bundlePrice: number;
	discountPercentage?: number;
	inheritedCostPrice: number;
	profitMarginPercent: number;

	// Galería Multimedia
	images: IProductBundleImage[];

	// Estado y Disponibilidad
	isActive: boolean;
	virtualStock?: number; // Calculado reactivamente en ejecución
	order?: number;

	// Métricas
	metrics?: {
		salesCount?: number;
		viewsCount?: number;
	};

	createdAt?: Date;
	updatedAt?: Date;
}

export interface IProductBundleDocument extends IProductBundle, Document {
	_id: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export interface ICreateProductBundleDTO {
	name: string;
	description?: string;
	category?: string;
	tags?: string[];
	items: Array<{
		product: string;
		variantSku?: string;
		quantity: number;
	}>;
	pricingType: 'custom' | 'sum_inherited';
	bundlePrice?: number;
	discountPercentage?: number;
	images?: IProductBundleImage[];
	isActive?: boolean;
	order?: number;
}

export interface IUpdateProductBundleDTO {
	name?: string;
	description?: string;
	category?: string;
	tags?: string[];
	items?: Array<{
		product: string;
		variantSku?: string;
		quantity: number;
	}>;
	pricingType?: 'custom' | 'sum_inherited';
	bundlePrice?: number;
	discountPercentage?: number;
	images?: IProductBundleImage[];
	isActive?: boolean;
	order?: number;
}
