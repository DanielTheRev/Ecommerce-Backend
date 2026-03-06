import {
	IPickupPoint,
	IShippingOption,
	ShippingType
} from '@/interfaces/shippingMethods.interface';
import mongoose, { Schema } from 'mongoose';

const pickupPointSchema = new Schema<IPickupPoint>({
	name: { type: String, required: true },
	address: { type: String }
});

// Schema principal
const shippingOptionSchema = new Schema<IShippingOption>(
	{
		type: {
			type: String,
			enum: Object.values(ShippingType),
			required: true
		},
		name: {
			type: String,
			required: true,
			trim: true
		},
		cost: {
			type: Number,
			required: true
		},
		pickupPoints: [pickupPointSchema],
		isActive: {
			type: Boolean,
			default: true
		},
		isDefaultForCash: {
			type: Boolean,
			default: false
		}
	},
	{
		timestamps: true
	}
);

// Índice para mejorar las consultas de puntos de venta
shippingOptionSchema.index({ type: 1, isDefaultForCash: 1 });

// Schema exportado para multi-tenancy (model registry)
export { shippingOptionSchema };

export const ShippingOption = mongoose.model<IShippingOption>(
	'ShippingOption',
	shippingOptionSchema
);
