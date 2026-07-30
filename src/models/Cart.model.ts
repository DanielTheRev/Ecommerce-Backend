import { Schema, model } from 'mongoose';
import { ICartDocument } from '@/interfaces/cart.interface';

const cartItemSchema = new Schema(
	{
		productId: {
			type: Schema.Types.ObjectId,
			ref: 'Product',
			required: true
		},
		sku: {
			type: String,
			required: true
		},
		brand: { type: String },
		model: { type: String },
		size: { type: String },
		color: {
			name: { type: String },
			hex: { type: String }
		},
		image: { type: String },
		priceEfectivo: { type: Number },
		priceCreditoDebito: { type: Number },
		quantity: {
			type: Number,
			required: true,
			min: 1,
			default: 1
		}
	},
	{ _id: false }
);

const cartSchema = new Schema<ICartDocument>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			unique: true
		},
		items: [cartItemSchema],
		selectedAddress: { type: Schema.Types.Mixed, default: null },
		paymentMethod: { type: String, default: null },
		shippingId: { type: String, default: null }
	},
	{
		timestamps: true,
		versionKey: false
	}
);

cartSchema.index({ user: 1 }, { unique: true });

export { cartSchema };

export const Cart = model<ICartDocument>('Cart', cartSchema);
