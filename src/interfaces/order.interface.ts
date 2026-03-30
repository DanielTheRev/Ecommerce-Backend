import mongoose, { Document } from 'mongoose';
import { OrderData } from 'ualabis-nodejs/dist/types/order';
import { PaymentType } from './paymentMethod.interface';
import { IPickupPoint, ShippingType } from './shippingMethods.interface';

export interface CreateOrderDTO {
	items: { _id: string; sku: string; quantity: number }[];
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
	formPayerData: IFormPayerData,
	mercadopagoData?: {
		token?: string;
		payment_method_id: string;
		installments: number;
		type: string;
		payer?: {
			email: string;
			first_name: string;
			last_name: string;
		};
		identification?: {
			type: string;
			number: string;
		}
	}
}

export interface IFormPayerData {
	firstName: string;
	lastName: string;
	email: string;
	identificationType: string;
	identificationNumber: string;
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

// Enum for sale type
export enum SaleType {
	ONLINE = 'ONLINE',
	LOCAL = 'LOCAL'
}

// Enum for order status
export enum OrderStatus {
	PENDING_PAYMENT = 'PENDING_PAYMENT',
	PROCESSING_SHIPPING = 'PROCESSING_SHIPPING',
	SHIPPED = 'SHIPPED',
	DELIVERED = 'DELIVERED',
	CANCELLED = 'CANCELLED'
}

// Enum for payment status
export enum PaymentStatus {
	PENDING = 'PENDING',
	APPROVED = 'APPROVED',
	REJECTED = 'REJECTED',
	CANCELLED = 'CANCELLED'
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
	mercadopagoData?: {
		items: Item[],
		status: string,
		status_detail: string,
		total_amount: string,
		total_paid_amount: string,
		transactions: TransactionsResponse
	};
}

// Interface para pagos divididos (Split Payments)
export interface ISplitPayment {
	method: PaymentType;
	amount: number;
	status: PaymentStatus;
	transactionId?: string;
}

// Interface principal de la orden
export interface IOrder {
	_id: string; // Used when lean()
	user?: mongoose.Types.ObjectId;
	seller?: mongoose.Types.ObjectId; // Empleado que realizó la venta local
	saleType: SaleType;
	buyerData: IFormPayerData;
	items: IOrderItem[];
	history: StatusEntry[];
	shippingInfo: IShippingInfo;
	paymentInfo: IPaymentInfo;
	splitPayments?: ISplitPayment[]; // Para ventas combinadas (Ej. Mitad efectivo, mitad débito)
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

import { Item, TransactionsResponse } from 'mercadopago/dist/clients/order/commonTypes';
import { EcommercePaymentProviders } from './ecommerce.interface';

// Respuestas de los servicios de ordenes para mayor tipado y uso en el front
export interface OrderPagination {
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsPerPage: number;
}

export interface GetOrdersByUserResponse {
	data: IOrderDocument[];
	pagination: OrderPagination;
}

export interface OrderStatusStats {
	count: number;
	totalAmount: number;
}

export interface GetAllOrdersResponse {
	data: IOrderDocument[];
	pagination: OrderPagination;
	stats: Record<string, OrderStatusStats>;
	filters: {
		status: string;
		userId: string | null;
		dateRange: string;
	};
}

export interface GetOrderStatsResponse {
	totalOrders: number;
	pendingOrders: number;
	processingOrders: number;
	shippedOrders: number;
	deliveredOrders: number;
	cancelledOrders: number;
	totalRevenue: { _id: any; total: number }[];
}

export interface MercadoPagoExtras {
	id?: string | number;
	status?: string;
	status_detail?: string;
	provider: EcommercePaymentProviders.MERCADOPAGO;
	ticket_url?: string;
	qr?: string;
}

export interface UalaExtras extends Omit<Partial<OrderData>, 'amount'> {
	provider: EcommercePaymentProviders.UALA;
	amount?: string | number;
}

export interface ManualPaymentExtras {
	provider: 'manual';
	name: string;
	instructions: string;
	status: 'waiting_confirmation';
}

export type CreateOrderExtras = MercadoPagoExtras | UalaExtras | ManualPaymentExtras;

export interface CreateOrderResponse {
	order: IOrderDocument;
	extras?: CreateOrderExtras;
}
