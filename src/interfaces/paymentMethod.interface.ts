import { Document } from 'mongoose';

// Payment types enum
export enum PaymentType {
	CASH = 'Efectivo',
	BANK_TRANSFER = 'Transferencia bancaria',
	ALIAS_TRANSFER = 'Transferencia a alias',
	CARD = 'Tarjeta de crédito / débito'
}

// Principal Interface
export interface IPaymentMethod extends Document {
	type: PaymentType;
	name: string;
	description?: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}
