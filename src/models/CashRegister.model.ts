import mongoose, { Schema } from 'mongoose';
import { ICashRegisterDocument, ICashRegisterModel, CashRegisterStatus } from '@/interfaces/cash-register.interface';

const cashRegisterSchema = new Schema<ICashRegisterDocument, ICashRegisterModel>(
	{
		openedAt: {
			type: Date,
			default: Date.now,
			required: true
		},
		closedAt: {
			type: Date
		},
		openedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true
		},
		closedBy: {
			type: Schema.Types.ObjectId,
			ref: 'User'
		},
		initialBalance: {
			type: Number,
			required: true,
			min: 0
		},
		calculatedCloseBalance: {
			type: Number,
			min: 0
		},
		actualCloseBalance: {
			type: Number,
			min: 0
		},
		difference: {
			type: Number
		},
		notes: {
			type: String,
			trim: true,
			maxlength: 500
		},
		status: {
			type: String,
			enum: Object.values(CashRegisterStatus),
			default: CashRegisterStatus.OPEN,
			required: true
		}
	},
	{
		timestamps: true
	}
);

cashRegisterSchema.index({ status: 1 });
cashRegisterSchema.index({ openedAt: -1 });

export { cashRegisterSchema };
export const CashRegister = mongoose.model<ICashRegisterDocument>('CashRegister', cashRegisterSchema);
