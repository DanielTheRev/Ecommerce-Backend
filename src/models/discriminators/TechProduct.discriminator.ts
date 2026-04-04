import { Schema } from 'mongoose';
import { Product } from '../Product.model';
import { TechVariantSchema } from '../schemas/techVariant.schema';

const TechProductSchema = new Schema({
	storage: [{ type: String }],
	ram: { type: String, trim: true },
	processor: { type: String, trim: true },
	screenSize: { type: String, trim: true },
	os: { type: String, trim: true },
	connectivity: [{ type: String }],
	variants: {
		type: [TechVariantSchema],
		default: []
	}
});

// SKU único por variante (scoped a la colección completa para evitar duplicados)
TechProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// Schema exportado para multi-tenancy (model registry)
export { TechProductSchema };

export const TechProduct = Product.discriminator('TechProduct', TechProductSchema);
