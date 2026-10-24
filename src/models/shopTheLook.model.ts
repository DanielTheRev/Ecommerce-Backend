import { Schema } from 'mongoose';
import { IShopTheLookDocument } from '@/interfaces/shopTheLook.interface';

const ShopTheLookImageSchema = new Schema(
	{
		url: { type: String, required: true },
		public_id: { type: String, required: true },
		width: { type: Number },
		height: { type: Number },
		alt: { type: String, trim: true }
	},
	{ _id: false }
);

const ShopTheLookProductItemSchema = new Schema(
	{
		product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
		position: {
			x: { type: Number, min: 0, max: 100 },
			y: { type: Number, min: 0, max: 100 }
		},
		selectedColor: {
			name: { type: String, trim: true },
			hex: { type: String, trim: true }
		},
		selectedSku: { type: String, trim: true },
		variantImage: { type: ShopTheLookImageSchema },
		isActive: { type: Boolean, default: true }
	},
	{ _id: true }
);

export const ShopTheLookSchema = new Schema<IShopTheLookDocument>(
	{
		name: { type: String, required: true, trim: true },
		title: { type: String, trim: true }, // Retrocompatibilidad
		subtitle: { type: String, trim: true }, // Retrocompatibilidad
		slug: { type: String, required: true, trim: true, lowercase: true, index: true },
		description: { type: String, trim: true },
		occasion: { type: String, trim: true }, // Ej: "Día & Tarde", "Noche", "Sastre"
		gallery: {
			type: [ShopTheLookImageSchema],
			default: []
		},
		products: {
			type: [ShopTheLookProductItemSchema],
			default: []
		},
		// Retrocompatibilidad con campañas legacy mientras se migra
		looks: [
			{
				name: { type: String, trim: true, default: '' },
				mainImage: { type: ShopTheLookImageSchema },
				hotspots: { type: [ShopTheLookProductItemSchema], default: [] },
				isActive: { type: Boolean, default: true }
			}
		],
		likes: { type: Number, default: 0 },
		shares: { type: Number, default: 0 },
		isActive: { type: Boolean, default: true },
		order: { type: Number, default: 0 },
		rankingScore: { type: Number, default: 100, index: true },
		effectiveScore: { type: Number, default: 100, index: true },
		metrics: {
			viewsCount: { type: Number, default: 0 },
			likesCount: { type: Number, default: 0 },
			sharesCount: { type: Number, default: 0 },
			cartAddsCount: { type: Number, default: 0 },
			salesCount: { type: Number, default: 0 }
		},
		seo: {
			metaTitle: { type: String, trim: true },
			metaDescription: { type: String, trim: true },
			metaImage: {
				url: { type: String },
				public_id: { type: String }
			}
		}
	},
	{
		timestamps: true
	}
);

ShopTheLookSchema.index({ order: 1, effectiveScore: -1, createdAt: -1 });

// Pre-save hook: asegurar compatibilidad entre name y title
ShopTheLookSchema.pre('save', function (next) {
	if (!this.name && this.title) {
		this.name = this.title;
	}
	if (!this.title && this.name) {
		this.title = this.name;
	}
	next();
});
