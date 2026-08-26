import { IBanner } from '@/interfaces/home.interface';
import mongoose, { Document, Schema } from 'mongoose';



const BannerSchema = new Schema(
	{
		name: { type: String, default: '' },
		image: { type: String, required: true },
		imageMobile: { type: String, default: '' },
		
		// Link & Redirección
		linkType: {
			type: String,
			enum: ['none', 'category', 'collection', 'brand', 'product', 'custom'],
			default: 'none'
		},
		linkValue: { type: String, default: '' },

		// Vitrina de productos
		showProducts: { type: Boolean, default: false },
		productSource: {
			type: String,
			enum: ['category', 'collection', 'brand', 'manual', 'recent'],
			default: 'recent'
		},
		productSourceValue: { type: String, default: '' },
		manualProductIds: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
		productsCount: { type: Number, default: 4 },

		// Legacy / Styling compatibility
		brandName: { type: String, default: '' },
		description: { type: String, default: '' },
		title: { type: String, default: '' },
		subtitle: { type: String, default: '' },
		textClass: { type: String, default: 'text-white' },
		buttonClass: { type: String, default: 'bg-white text-black' },
		icon: { type: String, default: 'Smartphone' },

		isActive: { type: Boolean, default: true },
		order: { type: Number, default: 0 }
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// Index for faster queries when sorting by order
BannerSchema.index({ order: 1 });

// Schema exportado para multi-tenancy (model registry)
export { BannerSchema };

export const Banner = mongoose.model<IBanner>('Banner', BannerSchema);
