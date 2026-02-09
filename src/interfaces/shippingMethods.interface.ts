import { Document } from 'mongoose';

// Shipping types Enum
export enum ShippingType {
	PICKUP = 'Punto de encuentro',
	HOME_DELIVERY = 'Envío a domicilio'
}

// IPickupPoint Interface
export interface IPickupPoint {
	name: string;
	address: string;
}

export interface IShippingOptionQuery {
	_id?: string;
	type?: ShippingType;
	isActive?: boolean;
	isDefaultForCash?: boolean;
}

export interface IShippingOption {
	type: ShippingType;
	name: string;
	cost: number;
	pickupPoints?: IPickupPoint[];
	isActive: boolean;
	isDefaultForCash: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export type IShippingOptionCreate = Omit<IShippingOption, 'createdAt' | 'updatedAt'>;

export type IShippingOptionUpdate = Partial<Omit<IShippingOption, 'createdAt' | 'updatedAt'>>;

export interface IShippingOptionDoc extends Document {
	type: ShippingType;
	name: string;
	cost: number;
	pickupPoints?: IPickupPoint[];
	isActive: boolean;
	isDefaultForCash: boolean;
	createdAt: Date;
	updatedAt: Date;
}
