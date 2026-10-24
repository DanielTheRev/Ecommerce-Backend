import { Document, Types } from 'mongoose';
import { IProductDocument, IProductSeo } from '@/interfaces/product.interface';

export interface IShopTheLookImage {
	url: string;
	public_id: string;
	width?: number;
	height?: number;
	alt?: string;
}

export interface IShopTheLookHotspotColor {
	name: string;
	hex?: string;
}

export interface IShopTheLookProductItem {
	_id?: Types.ObjectId | string;
	product: Types.ObjectId | IProductDocument;
	position?: {
		x: number;
		y: number;
	};
	selectedColor?: IShopTheLookHotspotColor;
	selectedSku?: string;
	variantImage?: IShopTheLookImage;
	isActive: boolean;
}

// Retrocompatibilidad con nombre anterior
export type IShopTheLookHotspot = IShopTheLookProductItem;

export interface ILookItem {
	_id?: Types.ObjectId | string;
	name?: string;
	mainImage?: IShopTheLookImage;
	gallery?: IShopTheLookImage[];
	hotspots?: IShopTheLookProductItem[];
	products?: IShopTheLookProductItem[];
	isActive: boolean;
}

export interface IShopTheLookMetrics {
	viewsCount?: number;
	likesCount?: number;
	sharesCount?: number;
	cartAddsCount?: number;
	salesCount?: number;
}

// Look individual e independiente (Chau Campañas)
export interface IShopTheLook {
	name: string;
	title?: string; // Retrocompatibilidad
	subtitle?: string; // Retrocompatibilidad
	slug: string;
	description?: string;
	occasion?: string;
	gallery: IShopTheLookImage[];
	products: IShopTheLookProductItem[];
	looks?: ILookItem[]; // Retrocompatibilidad temporal
	likes?: number;
	shares?: number;
	isActive: boolean;
	order?: number;
	rankingScore?: number;
	effectiveScore?: number;
	metrics?: IShopTheLookMetrics;
	seo?: IProductSeo;
}

export interface IShopTheLookDocument extends IShopTheLook, Document {
	createdAt: Date;
	updatedAt: Date;
}
