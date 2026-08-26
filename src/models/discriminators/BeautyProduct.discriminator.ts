import { Schema } from 'mongoose';
import { Product } from '../Product.model';
import { GeneralVariantSchema } from '../schemas/generalVariant.schema';

const ScentNotesSchema = new Schema({
	top: { type: String, trim: true },
	heart: { type: String, trim: true },
	base: { type: String, trim: true }
}, { _id: false });

const BeautyProductSchema = new Schema({
	volume: { type: String, trim: true },
	concentration: { type: String, trim: true },
	fragranceFamily: { type: String, trim: true },
	gender: { type: String, trim: true, default: 'Unisex' },
	scentNotes: { type: ScentNotesSchema, default: {} },
	applicationArea: { type: String, trim: true },
	variants: {
		type: [GeneralVariantSchema],
		default: []
	}
});

// SKU único por variante
BeautyProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// Schema exportado para multi-tenancy (model registry)
export { BeautyProductSchema };

export const BeautyProduct = Product.discriminator('BeautyProduct', BeautyProductSchema);
