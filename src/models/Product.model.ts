import mongoose, { Schema } from 'mongoose';
import { IProduct, IProductDocument, IProductCategories } from '../interfaces/product.interface';

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
			maxlength: 200
		},
		largeDescription: {
			type: String,
			required: true,
			trim: true,
			maxlength: 200
		},
		slug: { type: String, unique: true },
		prices: {
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
				'3_cuotas_sin_interes': {
					type: Number,
					required: true,
					default: 0
				},
				'6_cuotas_sin_interes': {
					type: Number,
					required: true,
					default: 0
				}
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
