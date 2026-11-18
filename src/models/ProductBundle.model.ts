import { Schema, model } from 'mongoose';
import { IProductBundleDocument } from '@/interfaces/productBundle.interface';

const ProductBundleItemSchema = new Schema(
	{
		product: {
			type: Schema.Types.ObjectId,
			ref: 'Product',
			required: [true, 'El producto componente es obligatorio']
		},
		variantSku: {
			type: String,
			trim: true
		},
		quantity: {
			type: Number,
			required: [true, 'La cantidad del componente es obligatoria'],
			min: [1, 'La cantidad mínima por componente es 1'],
			default: 1
		}
	},
	{ _id: true }
);

const ProductBundleImageSchema = new Schema(
	{
		url: { type: String, required: true },
		public_id: { type: String, default: '' },
		isMain: { type: Boolean, default: false },
		source: { type: String, enum: ['uploaded', 'inherited'], default: 'uploaded' }
	},
	{ _id: false }
);

export const ProductBundleSchema = new Schema<IProductBundleDocument>(
	{
		name: {
			type: String,
			required: [true, 'El nombre del conjunto de productos / combo es obligatorio'],
			trim: true,
			maxlength: 200
		},
		slug: {
			type: String,
			required: [true, 'El slug del combo es obligatorio'],
			trim: true,
			lowercase: true,
			index: true
		},
		description: {
			type: String,
			trim: true,
			maxlength: 1000
		},
		category: {
			type: String,
			trim: true
		},
		tags: {
			type: [String],
			default: [],
			index: true
		},
		items: {
			type: [ProductBundleItemSchema],
			validate: [
				(val: any[]) => Array.isArray(val) && val.length >= 2,
				'Un conjunto de productos debe tener al menos 2 productos componentes'
			]
		},
		pricingType: {
			type: String,
			enum: ['custom', 'sum_inherited'],
			default: 'custom',
			required: true
		},
		bundlePrice: {
			type: Number,
			required: [true, 'El precio del combo es obligatorio'],
			min: [0, 'El precio no puede ser negativo']
		},
		discountPercentage: {
			type: Number,
			min: 0,
			max: 100,
			default: 0
		},
		inheritedCostPrice: {
			type: Number,
			default: 0
		},
		profitMarginPercent: {
			type: Number,
			default: 0
		},
		images: {
			type: [ProductBundleImageSchema],
			default: []
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true
		},
		order: {
			type: Number,
			default: 0,
			index: true
		},
		metrics: {
			salesCount: { type: Number, default: 0 },
			viewsCount: { type: Number, default: 0 }
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

ProductBundleSchema.index({ slug: 1 });
ProductBundleSchema.index({ isActive: 1, order: 1, createdAt: -1 });

export const ProductBundle = model<IProductBundleDocument>('ProductBundle', ProductBundleSchema);
