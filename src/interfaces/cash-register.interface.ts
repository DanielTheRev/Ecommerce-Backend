import mongoose, { Document } from 'mongoose';

export enum CashRegisterStatus {
	OPEN = 'OPEN',
	CLOSED = 'CLOSED'
}

export interface ICashRegister {
	_id: string; // Used when lean()
	openedAt: Date;
	closedAt?: Date;
	openedBy: mongoose.Types.ObjectId;
	closedBy?: mongoose.Types.ObjectId;
	initialBalance: number;
	calculatedCloseBalance?: number;
	actualCloseBalance?: number;
	difference?: number;
	notes?: string;
	status: CashRegisterStatus;
	createdAt: Date;
	updatedAt: Date;
}

export interface ICashRegisterDocument extends Document, Omit<ICashRegister, '_id'> {
	_id: mongoose.Types.ObjectId;
}

export interface ICashRegisterModel extends mongoose.Model<ICashRegisterDocument> {}
