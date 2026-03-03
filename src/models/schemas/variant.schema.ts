import { Schema } from 'mongoose';

const VariantAttributeSchema = new Schema({
	key: { type: String, required: true },
	value: { type: String, required: true }
}, { _id: false });

const VariantColorSchema = new Schema({
	name: { type: String, required: true },
	hex: { type: String, required: true }
}, { _id: false });

export const VariantSchema = new Schema({
	sku: {
		type: String,
		required: true,
		trim: true,
		uppercase: true
	},
	attributes: {
		type: [VariantAttributeSchema],
		required: true,
		validate: {
			validator: (attrs: any[]) => attrs.length > 0,
			message: 'Al menos un atributo es requerido por variante'
		}
	},
	color: {
		type: VariantColorSchema,
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
	images: [{
		url: { type: String, required: true },
		public_id: { type: String, required: true }
	}],
	barcode: {
		type: String,
		trim: true
	}
}, { _id: true });
