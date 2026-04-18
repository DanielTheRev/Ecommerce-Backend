import { Document, Types } from 'mongoose';

export interface IAddress {
	_id: string;
	user: Types.ObjectId | string;
	alias: string;
	recipientName: string;
	street: string;
	number: string;
	apartment?: string;
	city: string;
	state: string;
	zipCode: string;
	phone: string;
	isDefault: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface IAddressDocument extends Omit<IAddress, '_id'>, Document {}

export interface ICreateAddressDTO extends Omit<IAddress, '_id' | 'user' | 'createdAt' | 'updatedAt'> {}

export interface IUpdateAddressDTO extends Partial<ICreateAddressDTO> {}
