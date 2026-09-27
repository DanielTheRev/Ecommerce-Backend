import mongoose, { Schema } from 'mongoose';
import { IMasterProductDocument } from '@/interfaces/masterProduct.interface';

export const MasterProductSchema = new Schema<IMasterProductDocument>(
	{
		barcode: {
			type: String,
			required: [true, 'El código de barras es requerido'],
			unique: true,
			trim: true,
			index: true
		},
		name: {
			type: String,
			required: [true, 'El nombre del producto es requerido'],
			trim: true,
			index: true
		},
		brand: {
			type: String,
			trim: true,
			default: 'Genérico',
			index: true
		},
		category: {
			type: String,
			required: [true, 'La categoría es requerida'],
			trim: true,
			index: true
		},
		description: {
			type: String,
			trim: true,
			default: ''
		},
		imageUrl: {
			type: String,
			trim: true,
			default: ''
		},
		unit: {
			type: String,
			trim: true,
			default: 'un'
		},
		isSoldByWeight: {
			type: Boolean,
			default: false,
			index: true
		},
		suggestedPrice: {
			type: Number,
			default: 0,
			min: 0
		},
		source: {
			type: String,
			enum: ['seed', 'crowdsourced', 'admin'],
			default: 'seed',
			index: true
		},
		verified: {
			type: Boolean,
			default: true,
			index: true
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// Índices para búsquedas de alta velocidad
MasterProductSchema.index({ name: 'text', brand: 'text', category: 'text' });
MasterProductSchema.index({ barcode: 1, verified: 1 });

export const MasterProduct = mongoose.model<IMasterProductDocument>('MasterProduct', MasterProductSchema);
