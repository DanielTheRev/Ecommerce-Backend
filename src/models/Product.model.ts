import mongoose, { Schema } from 'mongoose';
import { IProductCategories, IProductDocument } from '../interfaces/product.interface';
import { EarningsSchema } from './schemas/earning.schema';
import { CostPriceSchema } from './schemas/costPrice.schema';

const ProductSchema = new Schema(
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
				message: '{VALUE} no es una categoría válida' // Mensaje de error personalizado
			}
		},
		shortDescription: {
			type: String,
			required: true,
			trim: true,
			// maxlength: 200
		},
		largeDescription: {
			type: String,
			required: true,
			trim: true,
			// maxlength: 200
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
				default: 1.30, // Ejemplo: 30% de ganancia por defecto
				select: false
			},
			baseCommission: {
				type: Number,
				default: 4.9, // Ejemplo: 4.9% de comisión base por defecto
				select: false
			},
			cft6Cuotas: {
				type: Number,
				default: 18.9, // Ejemplo: 18.9% de CFT 6 cuotas por defecto
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
				cuotas_3_si: {
					type: Number,
					required: true,
					default: 0
				},
				cuotas_6_si: {
					type: Number,
					required: true,
					default: 0
				}
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
		images: [
			{
				url: { type: String, required: true },
				public_id: { type: String, required: true }
			}
		],
		features: [{ type: String }],
		colors: [{ type: String }],
		storage: [{ type: String }],
		specifications: [
			{
				key: { type: String, required: true },
				value: { type: String, required: true }
			}
		],
		stock: {
			type: Number,
			required: true,
			default: 0,
			min: 0
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

ProductSchema.index({ slug: -1 });
ProductSchema.index({ brand: 1, model: 1 });

export const Product = mongoose.model<IProductDocument>('Product', ProductSchema);
