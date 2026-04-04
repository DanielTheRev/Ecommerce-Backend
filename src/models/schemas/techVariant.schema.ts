import { Schema } from 'mongoose';

const TechVariantColorSchema = new Schema({
	name: { type: String, required: true },
	hex: { type: String, required: true }
}, { _id: false });

const TechVariantAttributeSchema = new Schema({
	key: { type: String, required: true },
	value: { type: String, required: true }
}, { _id: false });

export const TechVariantSchema = new Schema({
	sku: {
		type: String,
		required: true,
		trim: true,
		uppercase: true
	},
	// Atributos flexibles: RAM, almacenamiento, conectividad, etc.
	// Ej: [{ key: "RAM", value: "16GB" }, { key: "Almacenamiento", value: "512GB" }]
	attributes: {
		type: [TechVariantAttributeSchema],
		required: true,
		validate: {
			validator: (attrs: any[]) => attrs.length > 0,
			message: 'Al menos un atributo es requerido por variante tech'
		}
	},
	color: {
		type: TechVariantColorSchema,
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
