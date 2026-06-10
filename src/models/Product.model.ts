import mongoose, { Schema } from 'mongoose';
import { IProductDocument } from '../interfaces/product.interface';
import { CostPriceSchema } from './schemas/costPrice.schema';
import { CalculatedProfitsSchema } from './schemas/earning.schema';
import { CostConceptSchema } from './schemas/costConcept.schema';

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
		price: {
			listPrice: { type: Number, required: true, default: 0 },
			card_ticket1PayPrice: { type: Number, required: true, default: 0 },
			cashTransferPrice: { type: Number, required: true, default: 0 },
			discountPercentageTransfer: { type: Number, required: true, default: 0 },
			installments: {
				threePaymentsAmount: { type: Number, required: true, default: 0 },
				sixPaymentsAmount: { type: Number, required: true, default: 0 },
				hasThreeInstallmentsSeamless: { type: Boolean, required: true, default: false },
				hasSixInstallmentsSeamless: { type: Boolean, required: true, default: false }
			}
		},
		finance: {
			type: new Schema({
				exchangeRateSnapshot: { type: Number, required: true },
				mpCommissionSnapshot: {
					base: { type: Number, required: true },
					cft3Cuotas: { type: Number, required: true },
					cft6Cuotas: { type: Number, required: true }
				},
				providerCost: {
					type: CostPriceSchema,
					required: true
				},
				additionalCosts: [CostConceptSchema],
				pricingStrategy: {
					method: { type: String, enum: ['markup', 'margin'], required: true },
					targetProfit: { type: Number, required: true }
				},
				calculatedProfits: {
					type: CalculatedProfitsSchema,
					required: true
				}
			}, { _id: false }),
			required: true,
			select: false
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
		},
		provider: {
			type: Schema.Types.ObjectId,
			ref: 'Provider',
			select: false
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
