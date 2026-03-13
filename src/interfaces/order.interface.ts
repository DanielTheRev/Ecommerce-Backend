import mongoose, { Document } from 'mongoose';
import { OrderData } from 'ualabis-nodejs/dist/types/order';
import { ICartItemDTO } from './cart-item.interface';
import { PaymentType } from './paymentMethod.interface';
import { IPickupPoint, ShippingType } from './shippingMethods.interface';

export interface CreateOrderDTO {
	items: { _id: string; variantSku: string; quantity: number }[];
	shippingMethod: {
		_id: string;
		type: ShippingType;
		pickupPoint: IPickupPoint;
		cost: number;
	};
	paymentMethod: {
		_id: string;
		type: PaymentType;
	};
}

export interface StatusEntry {
	status: OrderStatus;
	timestamp: Date;
	note?: string;
}

export interface updatePaymentStatusDTO {
	orderID: string;
	status: PaymentStatus
}

export interface updateShippingStatusDTO {
	orderID: string;
	status: OrderStatus
}

// Enum for order status
export enum OrderStatus {
	PENDING = 'Pendiente de encuentro',
	PROCESSING_SHIPPING = 'En proceso de envío',
	SHIPPED = 'Enviado',
	DELIVERED = 'Entregado',
	CANCELLED = 'Cancelado'
}

// Enum for payment status
export enum PaymentStatus {
	PENDING = 'Pendiente',
	APPROVED = 'Aprobado',
	REJECTED = 'Rechazado',
	CANCELLED = 'Cancelado'
}

// Interface for order items
export interface IOrderItem {
	product: mongoose.Types.ObjectId;
	variantSku: string;
	variantLabel: string;
	quantity: number;
	price: number;
	// Snapshot del producto al momento de la compra (para integridad de datos)
	productSnapshot: {
		brand: string;
		model: string;
		image?: string;
	};
}

// Interface for shipping address
// export interface IShippingAddress {
// 	street: string;
// 	city: string;
// 	state: string;
// 	postalCode: string;
// 	country: string;
// 	phone?: string;
// }



// Interface for shipping information
export interface IShippingInfo {
	type: ShippingType;
	pickupPoint?: {
		name: string;
		address: string;
	};
	// shippingAddress?: IShippingAddress;
	cost: number;
	shippedAt: Date;
	deliveredAt: Date;
}

// Interface para información de pago
export interface IPaymentInfo {
	method: PaymentType;
	status: PaymentStatus;
	transactionId?: string;
	paymentDate?: Date;
	amount: number;
	ualaOrderStatus?: OrderData;
}

// Interface principal de la orden
export interface IOrder {
	_id: string; // Used when lean()
	user: mongoose.Types.ObjectId;
	items: IOrderItem[];
	history: StatusEntry[];
	shippingInfo: IShippingInfo;
	paymentInfo: IPaymentInfo;
	status: OrderStatus;
	shippingCost: number;
	total: number;
	earnings: number;
	orderNumber: string;
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface IOrderDocument extends Document, Omit<IOrder, '_id'> {
	_id: mongoose.Types.ObjectId;
}

// Interface para el modelo con métodos estáticos
export interface IOrderModel extends mongoose.Model<IOrderDocument> {
	findByUser(userId: string): Promise<IOrderDocument[]>;
}
