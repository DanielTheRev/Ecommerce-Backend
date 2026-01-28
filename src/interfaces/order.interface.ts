import { ICartItemDTO } from './cart-item.interface';
import mongoose, { Document, ObjectId } from 'mongoose';
import { OrderData } from 'ualabis-nodejs/dist/types/order';
import { PaymentType } from './paymentMethod.interface';
import { ShippingType, IPickupPoint } from './shippingMethods.interface';

export interface CreateOrderDTO {
	items: ICartItemDTO[];
	subtotal: number;
	total: number;
	desc: string | number;
	shippingCost: string | number;
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
	PAID = 'Pagado',
	REJECTED = 'Rechazado',
	CANCELLED = 'Cancelado'
}

// Interface for order items
export interface IOrderItem {
	product: mongoose.Types.ObjectId;
	quantity: number;
	price: number; // Precio al momento de la compra
	name: string; // Nombre del producto al momento de la compra
	image?: string; // Imagen del producto
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
export interface IOrder extends Document {
	user: mongoose.Types.ObjectId;
	items: IOrderItem[];
	shippingInfo: IShippingInfo;
	paymentInfo: IPaymentInfo;
	status: OrderStatus;
	shippingCost: number;
	total: number;
	orderNumber: string;
	notes?: string;
	createdAt: Date;
	updatedAt: Date;
	calculateTotals: () => number;
	updateStatus: (newStatus: OrderStatus) => Promise<IOrder>;
}

// Interface para el modelo con métodos estáticos
export interface IOrderModel extends mongoose.Model<IOrder> {
	findByUser(userId: string): Promise<IOrder[]>;
}
