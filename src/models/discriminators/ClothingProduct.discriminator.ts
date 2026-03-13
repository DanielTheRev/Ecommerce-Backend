import { Schema } from 'mongoose';
import { Product } from '../Product.model';
import { ClothingFit, ClothingGender, ClothingSizeType } from '@/interfaces/product.interface';

const CompositionSchema = new Schema({
	material: { type: String, required: true },
	percentage: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const ClothingProductSchema = new Schema({
	gender: {
		type: String,
		enum: Object.values(ClothingGender),
		required: true
	},
	fit: {
		type: String,
		enum: Object.values(ClothingFit),
		default: ClothingFit.Regular
	},
	material: {
		type: String,
		trim: true
	},
	composition: [CompositionSchema],
	sizeType: {
		type: String,
		enum: Object.values(ClothingSizeType),
		default: ClothingSizeType.Ropa
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
