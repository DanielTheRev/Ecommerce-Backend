import { Document } from 'mongoose';

// Shipping types Enum
export enum ShippingType {
	HOME_DELIVERY = 'Envío a domicilio',
	BRANCH_PICKUP = 'Retiro en sucursal',
	STORE_PICKUP = 'Retiro en local',
	PICKUP = 'Punto de encuentro'
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
	carrier?: string;
	estimatedDelivery?: string;
	instructions?: string;
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
	carrier?: string;
	estimatedDelivery?: string;
	instructions?: string;
	pickupPoints?: IPickupPoint[];
	isActive: boolean;
	isDefaultForCash: boolean;
	createdAt: Date;
	updatedAt: Date;
}
