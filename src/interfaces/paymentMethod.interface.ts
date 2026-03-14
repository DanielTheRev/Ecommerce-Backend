import { Document } from 'mongoose';

// Payment types enum
export enum PaymentType {
	CASH = 'CASH',
	BANK_TRANSFER = 'BANK_TRANSFER',
	ALIAS_TRANSFER = 'ALIAS_TRANSFER',
	CARD = 'CARD',
	TICKET = 'TICKET'
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