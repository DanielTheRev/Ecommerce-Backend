import mongoose, { Schema } from 'mongoose';
import { IProductCategories, IProductDocument } from '../interfaces/product.interface';
import { EarningsSchema } from './schemas/earning.schema';
import { CostPriceSchema } from './schemas/costPrice.schema';
import { VariantSchema } from './schemas/variant.schema';

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
			enum: {
				values: Object.values(IProductCategories),
				message: '{VALUE} no es una categoría válida'
			}
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
		// ============ NUEVO: Variantes con SKU + stock ============
		variants: {
			type: [VariantSchema],
			default: []
		},
		tags: {
			type: [String],
			default: [],
			index: true
		},
		lowStockThreshold: {
			type: Number,
			default: 3,
			min: 0
		}
	},
	{
		timestamps: true,
		versionKey: false,
		discriminatorKey: 'productType'
	}
);

// ========= VIRTUALS =========
BaseProductSchema.virtual('totalStock').get(function () {
	return this.variants
		.filter((v: any) => v.isActive)
		.reduce((sum: number, v: any) => sum + v.stock, 0);
});

BaseProductSchema.virtual('hasStock').get(function () {
	return this.variants.some((v: any) => v.isActive && v.stock > 0);
});

BaseProductSchema.set('toJSON', { virtuals: true });
BaseProductSchema.set('toObject', { virtuals: true });

// ========= INDEXES =========
BaseProductSchema.index({ slug: -1 });
BaseProductSchema.index({ brand: 1, model: 1 });
BaseProductSchema.index({ productType: 1 });
BaseProductSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });

// Schema exportado para multi-tenancy (model registry)
export { BaseProductSchema };

export const Product = mongoose.model<IProductDocument>('Product', BaseProductSchema);
