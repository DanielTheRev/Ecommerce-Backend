import { Schema } from 'mongoose';
import { Product } from '../Product.model';

const CompositionSchema = new Schema({
	material: { type: String, required: true },
	percentage: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const ClothingProductSchema = new Schema({
	gender: {
		type: String,
		enum: ['Hombre', 'Mujer', 'Unisex', 'Niños'],
		required: true
	},
	fit: {
		type: String,
		enum: ['Regular', 'Slim', 'Oversized', 'Relaxed'],
		default: 'Regular'
	},
	material: {
		type: String,
		trim: true
	},
	composition: [CompositionSchema],
	sizeType: {
		type: String,
		enum: ['Ropa', 'Calzado', 'Numérico'],
		default: 'Ropa'
	},
	careInstructions: [{ type: String }],
	season: {
		type: String,
		trim: true
	}
});

// Schema exportado para multi-tenancy (model registry)
export { ClothingProductSchema };

export const ClothingProduct = Product.discriminator('ClothingProduct', ClothingProductSchema);
