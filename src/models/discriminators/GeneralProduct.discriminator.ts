import { Schema } from 'mongoose';
import { Product } from '../Product.model';
import { GeneralVariantSchema } from '../schemas/generalVariant.schema';

const GeneralProductSchema = new Schema({
	unit: { type: String, trim: true, default: 'Unidad' },
	weight: { type: String, trim: true },
	variants: {
		type: [GeneralVariantSchema],
		default: []
	}
});

// SKU único por variante
GeneralProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// Schema exportado para multi-tenancy (model registry)
export { GeneralProductSchema };

export const GeneralProduct = Product.discriminator('GeneralProduct', GeneralProductSchema);
