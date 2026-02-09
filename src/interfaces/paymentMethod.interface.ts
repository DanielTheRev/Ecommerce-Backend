import { Document } from 'mongoose';

// Payment types enum
export enum PaymentType {
	CASH = 'Efectivo',
	BANK_TRANSFER = 'Transferencia bancaria',
	ALIAS_TRANSFER = 'Transferencia a alias',
	CARD = 'Tarjeta de crédito / débito'
}

export interface IPaymentMethod {
	type: PaymentType;
	name: string;
	description?: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

// Principal Interface
export interface IPaymentMethodDocument extends Document {
	type: PaymentType;
	name: string;
	description?: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface IPaymentMethodQuery {
	type?: PaymentType;
	name?: string;
	isActive?: boolean;
}