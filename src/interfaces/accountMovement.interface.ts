import { Document, Types } from 'mongoose';

export enum AccountMovementType {
	CHARGE = 'CHARGE',         // Compra fiada / Cargo a la cuenta
	PAYMENT = 'PAYMENT',       // Cobro / Entrega de dinero
	ADJUSTMENT = 'ADJUSTMENT'  // Ajuste manual de saldo
}

export enum AccountPaymentMethod {
	CASH = 'CASH',
	TRANSFER = 'TRANSFER',
	CARD = 'CARD',
	OTHER = 'OTHER'
}

export interface IAccountMovement {
	_id: string;
	client: Types.ObjectId | string;
	type: AccountMovementType;
	amount: number;
	previousBalance: number;
	newBalance: number;
	order?: Types.ObjectId | string;
	cashRegister?: Types.ObjectId | string;
	paymentMethod?: AccountPaymentMethod;
	notes?: string;
	createdBy: Types.ObjectId | string;
	createdAt: Date;
	updatedAt: Date;
}

export interface IAccountMovementDocument extends IAccountMovement, Document {
	_id: any;
}

export interface RecordPaymentDTO {
	amount: number;
	paymentMethod: AccountPaymentMethod;
	cashRegisterId?: string;
	notes?: string;
}

export interface RecordAdjustmentDTO {
	newBalance: number;
	reason: string;
}

export interface UpdateCreditLimitDTO {
	creditLimit: number;
	isCreditAllowed?: boolean;
}

export interface DebtorSummaryItem {
	_id: string;
	name: string;
	lastName?: string;
	phone?: string;
	email?: string;
	balance: number;
	creditLimit: number;
	isCreditAllowed: boolean;
	lastMovementDate?: Date;
}
