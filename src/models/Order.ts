import mongoose, { Schema, Document, ObjectId } from 'mongoose';
import { PaymentType } from './PaymentMethod';
import { ShippingType } from './ShippingOption';
import { OrderData } from 'ualabis-nodejs/dist/types/order';

// Enum para estados de orden
export enum OrderStatus {
	PENDING = 'Pendiente de encuentro',
	PROCESSING_SHIPPING = 'En proceso de envío',
	SHIPPED = 'Enviado',
	DELIVERED = 'Entregado',
	CANCELLED = 'Cancelado'
}

// Enum para estados de pago
export enum PaymentStatus {
  PENDING = 'Pendiente',
  APPROVED = 'Aprobado',
  PAID = 'Pagado',
  REJECTED = 'Rechazado',
  CANCELLED = 'Cancelado',
}

// Interface para items de la orden
export interface IOrderItem {
	product: mongoose.Types.ObjectId;
	quantity: number;
	price: number; // Precio al momento de la compra
	name: string; // Nombre del producto al momento de la compra
	image?: string; // Imagen del producto
}

// Interface para dirección de envío
// export interface IShippingAddress {
// 	street: string;
// 	city: string;
// 	state: string;
// 	postalCode: string;
// 	country: string;
// 	phone?: string;
// }

// Interface para información de envío
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
	findByUser(userId: ObjectId): Promise<IOrder[]>;
}

// Schema para items de la orden
const orderItemSchema = new Schema<IOrderItem>({
	product: {
		type: Schema.Types.ObjectId,
		ref: 'Product',
		required: true
	},
	quantity: {
		type: Number,
		required: true,
		min: 1
	},
	price: {
		type: Number,
		required: true,
		min: 0
	},
	name: {
		type: String,
		required: true,
		trim: true
	},
	image: {
		type: String,
		trim: true
	}
});

// Schema para dirección de envío
// const shippingAddressSchema = new Schema<IShippingAddress>({
// 	street: {
// 		type: String,
// 		required: true,
// 		trim: true
// 	},
// 	city: {
// 		type: String,
// 		required: true,
// 		trim: true
// 	},
// 	state: {
// 		type: String,
// 		required: true,
// 		trim: true
// 	},
// 	postalCode: {
// 		type: String,
// 		required: true,
// 		trim: true
// 	},
// 	country: {
// 		type: String,
// 		required: true,
// 		trim: true,
// 		default: 'Argentina'
// 	},
// 	phone: {
// 		type: String,
// 		trim: true
// 	}
// });

// Schema para información de envío
const shippingInfoSchema = new Schema<IShippingInfo>({
	type: {
		type: String,
		enum: Object.values(ShippingType),
		required: true
	},
	pickupPoint: {
		name: {
			type: String,
			trim: true
		},
		address: {
			type: String,
			trim: true
		}
	},
	// shippingAddress: {
	// 	type: shippingAddressSchema,
	// 	required: function () {
	// 		return this.type === ShippingType.HOME_DELIVERY;
	// 	}
	// },
	cost: {
		type: Number,
		required: true,
		min: 0
	}
});

// Schema para información de pago
const paymentInfoSchema = new Schema<IPaymentInfo>({
	method: {
		type: String,
		enum: Object.values(PaymentType),
		required: true
	},
	status: {
		type: String,
		enum: Object.values(PaymentStatus),
		required: true,
		default: PaymentStatus.PENDING
	},
	transactionId: {
		type: String,
		trim: true
	},
	paymentDate: {
		type: Date
	},
	amount: {
		type: Number,
		required: true,
		min: 0
	},
	ualaOrderStatus: {
		type: Object,
		default: undefined
	}
});
paymentInfoSchema.pre('save', function (next) {
	// Generar transactionId si no existe
	if (!this.transactionId) {
		const timestamp = Date.now().toString();
		const random = Math.random().toString(36).substring(2, 6).toUpperCase();
		this.transactionId = `TX-${timestamp}-${random}`;
	}
	// Guardar la fecha automáticamente si el estado del pago cambia
	if (this.isModified('status')) {
		this.paymentDate = new Date();
	}
	return next();
});

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
orderSchema.index({ orderNumber: 1 });
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

// Método para calcular totales
orderSchema.methods.calculateTotals = function () {
	this.subtotal = this.items.reduce((sum: any, item: any) => sum + item.price * item.quantity, 0);
	this.total = this.subtotal + this.tax + this.shippingCost;
	return this.total;
};

// Método para actualizar estado de la orden
orderSchema.methods.updateStatus = function (newStatus: OrderStatus) {
	this.status = newStatus;
	if (newStatus === OrderStatus.DELIVERED) {
		this.paymentInfo.status = PaymentStatus.APPROVED;
		this.paymentInfo.paymentDate = new Date();
	}
	return this.save();
};

// Método estático para buscar órdenes por usuario
orderSchema.statics.findByUser = async function (
	userId: ObjectId,
	page: number = 1,
	limit: number = 20
) {
	const skip = (page - 1) * limit;
	const orders = await this.find({ user: userId })
		.skip(skip)
		.limit(limit)
		.populate('items.product', 'name price images')
		.sort({ createdAt: -1 });

	const total = await orders.length;
	return {
		data: orders,
		pagination: {
			currentPage: page,
			totalPages: Math.ceil(total / limit),
			totalItems: total,
			itemsPerPage: limit
		}
	};
};

export default mongoose.model<IOrder, IOrderModel>('Order', orderSchema) as IOrderModel;
