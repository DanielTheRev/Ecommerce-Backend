import { Document, Types } from 'mongoose';

export interface ICartItemPayload {
	productId: string;
	sku: string;
	brand?: string;
	model?: string;
	size?: string;
	color?: {
		name?: string;
		hex?: string;
	};
	image?: string;
	priceEfectivo?: number;
	priceCreditoDebito?: number;
	quantity: number;
}

export interface ICartDocument extends Document {
	user: Types.ObjectId;
	items: {
		productId: Types.ObjectId;
		sku: string;
		brand?: string;
		model?: string;
		size?: string;
		color?: {
			name?: string;
			hex?: string;
		};
		image?: string;
		priceEfectivo?: number;
		priceCreditoDebito?: number;
		quantity: number;
	}[];
	selectedAddress?: any;
	paymentMethod?: string;
	shippingId?: string;
	createdAt: Date;
	updatedAt: Date;
}
