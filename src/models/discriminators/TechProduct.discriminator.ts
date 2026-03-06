import { Schema } from 'mongoose';
import { Product } from '../Product.model';

const TechProductSchema = new Schema({
	storage: [{ type: String }],
	ram: { type: String, trim: true },
	processor: { type: String, trim: true },
	screenSize: { type: String, trim: true },
	os: { type: String, trim: true },
	connectivity: [{ type: String }]
});

// Schema exportado para multi-tenancy (model registry)
export { TechProductSchema };

export const TechProduct = Product.discriminator('TechProduct', TechProductSchema);
