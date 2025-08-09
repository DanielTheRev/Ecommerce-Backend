import mongoose, { Schema, Document } from 'mongoose';

// Enum para tipos de métodos de pago
export enum PaymentType {
	CASH = 'Efectivo',
	BANK_TRANSFER = 'Transferencia bancaria',
	ALIAS_TRANSFER = 'Transferencia a alias',
	CARD = 'Tarjeta de crédito / débito'
}

// Interface principal del documento
export interface IPaymentMethod extends Document {
	type: PaymentType;
	name: string;
	description?: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

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
		},
	},
	{
		timestamps: true
	}
);

// Índice para mejorar las consultas
paymentMethodSchema.index({ type: 1, isActive: 1 });

export const PaymentMethod = mongoose.model<IPaymentMethod>(
	'PaymentMethod',
	paymentMethodSchema
);
