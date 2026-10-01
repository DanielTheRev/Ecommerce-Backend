import { Schema } from 'mongoose';
import { IShopTheLookDocument } from '@/interfaces/shopTheLook.interface';

const ShopTheLookImageSchema = new Schema(
	{
		url: { type: String, required: true },
		public_id: { type: String, required: true }
	},
	{ _id: false }
);

const ShopTheLookHotspotSchema = new Schema(
	{
		product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
		position: {
			x: { type: Number, required: true, min: 0, max: 100 },
			y: { type: Number, required: true, min: 0, max: 100 }
		},
		selectedColor: {
			name: { type: String, trim: true },
			hex: { type: String, trim: true }
		},
		selectedSku: { type: String, trim: true },
		variantImage: {
			url: { type: String, trim: true },
			public_id: { type: String, trim: true }
		},
		isActive: { type: Boolean, default: true }
	},
	{ _id: true }
);

export const ShopTheLookSchema = new Schema<IShopTheLookDocument>(
	{
		title: { type: String, required: true, trim: true },
		subtitle: { type: String, trim: true },
		slug: { type: String, trim: true, lowercase: true, index: true },
		looks: [
			{
				name: { type: String, trim: true, default: '' },
				mainImage: { type: ShopTheLookImageSchema, required: true },
				hotspots: { type: [ShopTheLookHotspotSchema], default: [] },
				isActive: { type: Boolean, default: true }
			}
		],
		isActive: { type: Boolean, default: true }
	},
	{
		timestamps: true
	}
);
