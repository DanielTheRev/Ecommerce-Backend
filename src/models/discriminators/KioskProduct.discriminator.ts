import { Schema } from 'mongoose';
import { Product } from '../Product.model';
import { GeneralVariantSchema } from '../schemas/generalVariant.schema';

const KioskProductSchema = new Schema({
	barcode: { type: String, trim: true, sparse: true, index: true },
	isSoldByWeight: { type: Boolean, default: false },
	unit: { type: String, trim: true, default: 'Unidad' },
	weight: { type: String, trim: true },
	variants: {
		type: [GeneralVariantSchema],
		default: []
	}
});

// SKU único por variante
KioskProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// Schema exportado para multi-tenancy (model registry)
export { KioskProductSchema };

export const KioskProduct = Product.discriminator('KioskProduct', KioskProductSchema);
