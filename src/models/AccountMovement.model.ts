import mongoose, { Schema } from 'mongoose';
import { IAccountMovementDocument, AccountMovementType, AccountPaymentMethod } from '@/interfaces/accountMovement.interface';

const accountMovementSchema = new Schema<IAccountMovementDocument>(
	{
		client: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: [true, 'El cliente es obligatorio para el movimiento de cuenta corriente'],
			index: true
		},
		type: {
			type: String,
			enum: Object.values(AccountMovementType),
			required: true
		},
		amount: {
			type: Number,
			required: true,
			min: [0.01, 'El monto del movimiento debe ser mayor a 0']
		},
		previousBalance: {
			type: Number,
			required: true,
			default: 0
		},
		newBalance: {
			type: Number,
			required: true,
			default: 0
		},
		order: {
			type: Schema.Types.ObjectId,
			ref: 'Order',
			index: true
		},
		cashRegister: {
			type: Schema.Types.ObjectId,
			ref: 'CashRegister',
			index: true
		},
		paymentMethod: {
			type: String,
			enum: Object.values(AccountPaymentMethod)
		},
		notes: {
			type: String,
			trim: true,
			maxlength: [500, 'Las notas no pueden superar 500 caracteres']
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true
		}
	},
	{
		timestamps: true
	}
);

accountMovementSchema.index({ client: 1, createdAt: -1 });
accountMovementSchema.index({ createdAt: -1 });

export { accountMovementSchema };
export const AccountMovement = mongoose.model<IAccountMovementDocument>('AccountMovement', accountMovementSchema);
