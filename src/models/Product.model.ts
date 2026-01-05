import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import { IProduct, IProductDocument } from '../interfaces/product.interface';
import slugify from 'slugify';

const ProductSchema: Schema = new Schema<IProduct>(
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
			tarjeta_credito_3_cuotas: {
				type: Number,
				required: true,
				default: 0
			},
			tarjeta_credito_6_cuotas: {
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
			default: null,
			min: 0,
			max: 5
		},
		reviews: {
			type: Number,
			default: null,
			min: 0
		},
		image: {
			light: {
				type: String,
				required: true,
				trim: true
			},
			dark: {
				type: String,
				required: true,
				trim: true
			}
		},
		features: {
			principalFeatures: [
				{
					type: String,
					trim: true
				}
			]
		},
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
ProductSchema.pre('save', function (next) {
	if (
		this.isModified('brand') ||
		this.isModified('model') ||
		this.slug === null ||
		this.slug === undefined
	) {
		this.slug = slugify((this.brand + ' ' + this.model) as string, { lower: true, strict: true });
	}
	next();
});

// Índices para mejorar el rendimiento
// `name` y `price` no existen explícitamente en este esquema (se usan `brand`, `model`, `prices`).
// Eliminamos índices inválidos para evitar errores/advertencias.
ProductSchema.index({ rating: -1 });

export const Product = mongoose.model<IProductDocument>('Product', ProductSchema);
