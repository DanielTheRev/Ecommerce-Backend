import { Schema } from 'mongoose';

const VariantColorSchema = new Schema({
	name: { type: String, required: true },
	hex: { type: String, required: true }
}, { _id: false });

export const GeneralVariantSchema = new Schema({
	sku: {
		type: String,
		required: true,
		trim: true,
		uppercase: true
	},
	color: {
		type: VariantColorSchema,
		required: false
	},
	size: {
		type: String,
		required: false,
		trim: true
	},
	volume: {
		type: String,
		required: false,
		trim: true
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
	imageIndex: {
		type: Number,
		required: false,
		default: 0
	},
	barcode: {
		type: String,
		trim: true
	}
}, { _id: true });
