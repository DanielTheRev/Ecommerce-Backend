import mongoose, { Schema } from 'mongoose';
import { IProductDocument } from '../interfaces/product.interface';
import { CostPriceSchema } from './schemas/costPrice.schema';
import { EarningsSchema } from './schemas/earning.schema';

const BaseProductSchema = new Schema(
	{
		brand: {
			type: String,
			required: true,
			trim: true,
			maxlength: 200
		},
		model: {
			type: String,
			required: true,
			trim: true,
			maxlength: 200
		},
		category: {
			type: String,
			required: [true, 'La categoría es obligatoria'],
		},
		shortDescription: {
			type: String,
			required: true,
			trim: true,
		},
		largeDescription: {
			type: String,
			required: true,
			trim: true,
		},
		slug: { type: String, unique: true },
		prices: {
			costPrice: {
				type: CostPriceSchema,
				required: true,
				select: false
			},
			dolarPrice: {
				type: Number,
				required: true,
				select: false
			},
			profitMargin: {
				type: Number,
				default: 1.30,
				select: false
			},
			baseCommission: {
				type: Number,
				default: 4.9,
				select: false
			},
			cft6Cuotas: {
				type: Number,
				default: 18.9,
				select: false
			},
			efectivo_transferencia: {
				type: Number,
				required: true,
				default: 0
			},
			tarjeta_credito_debito: {
				type: Number,
				required: true,
				default: 0
			},
			cuotas: {
				cuotas_3_si: { type: Number, required: true, default: 0 },
				cuotas_6_si: { type: Number, required: true, default: 0 }
			},
			earnings: {
				type: EarningsSchema,
				select: false
			}
		},
		discount: {
			type: Number,
			required: true,
			default: 0,
			min: 0,
			max: 100
		},
		rating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5
		},
		reviews: {
			type: Number,
			default: 0,
			min: 0
		},
		customProfitMargin: {
			type: Number,
			required: false,
			select: false
		},
		images: [
			{
				url: { type: String, required: true },
				public_id: { type: String, required: true }
			}
		],
		features: [{ type: String }],
		specifications: [
			{
				key: { type: String, required: true },
				value: { type: String, required: true }
			}
		],
		tags: {
			type: [String],
			default: [],
			index: true
		},
		lowStockThreshold: {
			type: Number,
			default: 3,
			min: 0
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true // Índice para que las consultas del frontend vuelen
		},
		isFeatured: {
			type: Boolean,
			default: false,
			index: true // Súper importante el índice porque vamos a buscar mucho por este campo
		},
		seo: {
			metaTitle: { type: String },
			metaDescription: { type: String },
			metaImage: {
				url: { type: String },
				public_id: { type: String }
			}
		}
	},
	{
		timestamps: true,
		versionKey: false,
		discriminatorKey: 'productType'
	}
);

BaseProductSchema.set('toJSON', { virtuals: true });
BaseProductSchema.set('toObject', { virtuals: true });

// ========= INDEXES =========
BaseProductSchema.index({ slug: -1 });
BaseProductSchema.index({ brand: 1, model: 1 });
BaseProductSchema.index({ productType: 1 });

// Schema exportado para multi-tenancy (model registry)
export { BaseProductSchema };

export const Product = mongoose.model<IProductDocument>('Product', BaseProductSchema);
