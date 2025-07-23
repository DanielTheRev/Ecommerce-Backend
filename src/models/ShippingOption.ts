import mongoose, { Schema, Document } from 'mongoose';

// Enum para tipos de envío
export enum ShippingType {
	PICKUP = 'Punto de encuentro', // Punto de encuentro
	HOME_DELIVERY = 'Envío a domicilio' // Envío a domicilio
}

// Interface para punto de venta
interface IPickupPoint {
	name: string;
	address: string;
}

// Interface principal del documento
export interface IShippingOption extends Document {
	type: ShippingType;
	name: string;
	cost: number;
	pickupPoints?: IPickupPoint[];
	isDefaultForCash: boolean;
	createdAt: Date;
	updatedAt: Date;
}

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

export const ShippingOption = mongoose.model<IShippingOption>(
	'ShippingOption',
	shippingOptionSchema
);
