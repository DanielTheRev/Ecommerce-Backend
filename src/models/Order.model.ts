import mongoose, { Schema } from 'mongoose';

import {
	IOrder,
	IOrderItem,
	IOrderModel,
	OrderStatus,
	PaymentStatus
} from '@/interfaces/order.interface';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';

import { orderItemSchema } from './schemas/orderItem.schema';
import { paymentInfoSchema } from './schemas/paymentInfo.schema';
import { shippingInfoSchema } from './schemas/shippingInfo.schema';


// Schema principal de la orden
const orderSchema = new Schema<IOrder, IOrderModel>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true
		},
		items: {
			type: [orderItemSchema],
			required: true,
			validate: {
				validator: function (items: IOrderItem[]) {
					return items.length > 0;
				},
				message: 'La orden debe tener al menos un item'
			}
		},
		shippingInfo: {
			type: shippingInfoSchema,
			required: true
		},
		paymentInfo: {
			type: paymentInfoSchema,
			required: true
		},
		status: {
			type: String,
			enum: Object.values(OrderStatus),
			default: OrderStatus.PENDING
		},
		shippingCost: {
			type: Number,
			required: true,
			min: 0,
			default: 0
		},
		total: {
			type: Number,
			required: true,
			min: 0
		},
		orderNumber: {
			type: String,
			unique: true,
			trim: true
		},
		notes: {
			type: String,
			trim: true,
			maxlength: 500
		}
	},
	{
		timestamps: true
	}
);

// Índices para optimizar consultas
orderSchema.index({ user: 1, createdAt: -1 });
// `orderNumber` tiene `unique: true` en su definición de campo, por lo que
// Mongoose/Natively Mongo crea el índice. Evitamos declaración duplicada.
orderSchema.index({ status: 1 });
orderSchema.index({ 'paymentInfo.status': 1 });

// Middleware para generar número de orden antes de guardar
orderSchema.pre('save', async function (next) {
	if (!this.orderNumber) {
		const timestamp = Date.now().toString();
		const random = Math.random().toString(36).substring(2, 8).toUpperCase();
		this.orderNumber = `EH-${timestamp}-${random}`;
	}

	// Validar que el pago en efectivo solo sea permitido con pickup
	if (
		this.paymentInfo.method === PaymentType.CASH &&
		this.shippingInfo.type !== ShippingType.PICKUP
	) {
		return next(
			new Error('El pago en efectivo solo está disponible para retiro en punto de venta')
		);
	}

	next();
});

// Método para actualizar estado de la orden
orderSchema.methods.updateStatus = function (newStatus: OrderStatus) {
	this.status = newStatus;
	if (newStatus === OrderStatus.DELIVERED) {
		this.paymentInfo.status = PaymentStatus.APPROVED;
		this.paymentInfo.paymentDate = new Date();
	}
	return this.save();
};



export default mongoose.model<IOrder, IOrderModel>('Order', orderSchema) as IOrderModel;
