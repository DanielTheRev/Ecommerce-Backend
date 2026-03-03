import { IOrderItem } from '@/interfaces/order.interface';
import { Schema } from 'mongoose';

export const orderItemSchema = new Schema<IOrderItem>({
	product: {
		type: Schema.Types.ObjectId,
		ref: 'Product',
		required: true
	},
	variantSku: {
		type: String,
		required: true,
		trim: true
	},
	variantLabel: {
		type: String,
		trim: true,
		default: ''
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
	// Snapshot del producto al momento de la compra
	// Así si el producto cambia de nombre/imagen, la orden mantiene el registro original
	productSnapshot: {
		brand: { type: String, required: true },
		model: { type: String, required: true },
		image: { type: String }
	}
});