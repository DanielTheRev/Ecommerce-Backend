import { Schema } from 'mongoose';

const ClothingVariantColorSchema = new Schema({
	name: { type: String, required: true },
	hex: { type: String, required: true }
}, { _id: false });

export const ClothingVariantSchema = new Schema({
	sku: {
		type: String,
		required: true,
		trim: true,
		uppercase: true
	},
	// Talle del producto (XS, S, M, L, XL, 40, 42, W32 L34, etc.)
	size: {
		type: String,
		required: true,
		trim: true
	},
	color: {
		type: ClothingVariantColorSchema,
		required: false
	},
	stock: {
		type: Number,
		required: true,
		default: 0,
		min: 0
	},
	reservedStock: {
		type: Number,
		default: 0,
		min: 0
	},
	isActive: {
		type: Boolean,
		default: true
	},
	imageReference: {
		url: { type: String, required: false },
		public_id: { type: String, required: false }
	},
	barcode: {
		type: String,
		trim: true
	}
}, { _id: true });
