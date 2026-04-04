import mongoose, { Schema } from 'mongoose';

import {
	IOrder,
	IOrderItem,
	IOrderModel,
	OrderStatus,
	SaleType
} from '@/interfaces/order.interface';

import { orderItemSchema } from './schemas/orderItem.schema';
import { paymentInfoSchema } from './schemas/paymentInfo.schema';
import { shippingInfoSchema } from './schemas/shippingInfo.schema';
import { splitPaymentSchema } from './schemas/splitPayment.schema';
import { statusEntrySchema } from './schemas/statusEntry.schema';


// Schema principal de la orden
const orderSchema = new Schema<IOrder, IOrderModel>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: false
		},
		seller: {
			type: Schema.Types.ObjectId,
			ref: 'User'
		},
		buyerData: {
			firstName: { type: String, required: true },
			lastName: { type: String, required: true },
			email: { type: String, required: true },
			identificationType: {
				type: String, required: function () {
					return this.user ? false : true;
				}
			},
			identificationNumber: {
				type: String, required: function () {
					return this.user ? false : true;
				}
			}
		},
		saleType: {
			type: String,
			enum: Object.values(SaleType),
			default: SaleType.ONLINE
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
		splitPayments: {
			type: [splitPaymentSchema],
			default: undefined
		},
		history: [statusEntrySchema],
		status: {
			type: String,
			enum: Object.values(OrderStatus),
			default: OrderStatus.PENDING_PAYMENT
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
		earnings: {
			type: Number,
			required: true,
			default: 0
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
orderSchema.index({ status: 1 });
orderSchema.index({ 'paymentInfo.status': 1 });





// Schema exportado para multi-tenancy (model registry)
export { orderSchema };

export default mongoose.model<IOrder, IOrderModel>('Order', orderSchema) as IOrderModel;
