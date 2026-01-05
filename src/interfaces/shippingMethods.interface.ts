import { Document } from 'mongoose';

// Shipping types Enum
export enum ShippingType {
	PICKUP = 'Punto de encuentro', // Punto de encuentro
	HOME_DELIVERY = 'Envío a domicilio' // Envío a domicilio
}

// IPickupPoint Interface
export interface IPickupPoint {
	name: string;
	address: string;
}

export interface IShippingOption extends Document {
	type: ShippingType;
	name: string;
	cost: number;
	pickupPoints?: IPickupPoint[];
	isDefaultForCash: boolean;
	createdAt: Date;
	updatedAt: Date;
}
