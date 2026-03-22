import { Document, Types } from 'mongoose';
import { IProductDocument } from '@/interfaces/product.interface';

export interface IShopTheLookImage {
	url: string;
	public_id: string;
}

export interface IShopTheLookHotspot {
	product: Types.ObjectId | IProductDocument;
	position: {
		x: number;
		y: number;
	};
	isActive: boolean;
}

export interface IShopTheLook {
	title: string;
	subtitle: string;
	looks: {
		mainImage: IShopTheLookImage;
		hotspots: IShopTheLookHotspot[];
		isActive: boolean;
	}[];
	isActive: boolean;
}

export interface IShopTheLookDocument extends IShopTheLook, Document {
	createdAt: Date;
	updatedAt: Date;
}
