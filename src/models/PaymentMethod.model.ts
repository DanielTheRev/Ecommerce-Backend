import { IPaymentMethod, PaymentType } from '@/interfaces/paymentMethod.interface';
import mongoose, { Schema } from 'mongoose';

// Schema principal
const paymentMethodSchema = new Schema<IPaymentMethod>(
	{
		type: {
			type: String,
			enum: Object.values(PaymentType),
			required: true
		},
		name: {
			type: String,
			required: true,
			trim: true
		},
		description: {
			type: String,
			trim: true
		},
		isActive: {
			type: Boolean,
			default: true
		}
	},
	{
		timestamps: true
	}
);

// Índice para mejorar las consultas
paymentMethodSchema.index({ type: 1, isActive: 1 });

// Schema exportado para multi-tenancy (model registry)
export { paymentMethodSchema };

export const PaymentMethod = mongoose.model<IPaymentMethod>('PaymentMethod', paymentMethodSchema);
