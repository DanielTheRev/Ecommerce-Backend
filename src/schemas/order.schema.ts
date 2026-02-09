import { z } from 'zod';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { OrderStatus, PaymentStatus } from '@/interfaces/order.interface';

// Cart Item Schema
const CartItemSchema = z.object({
	_id: z.string().min(1),
	quantity: z.number().int().positive(),
	price: z.number().nonnegative(),
	// Add other fields if necessary based on usage, but usually ID and Qty are critical for backend verification
});

// Create Order Schema
export const CreateOrderSchema = z.object({
	body: z.object({
		items: z.array(CartItemSchema).min(1, 'Order must have at least one item'),
		subtotal: z.number().nonnegative(),
		total: z.number().nonnegative(),
		desc: z.number().nonnegative().optional(), // Discount
		shippingCost: z.number().nonnegative().or(z.string().transform(val => Number(val))),
		
		shippingMethod: z.object({
			_id: z.string().min(1),
			type: z.enum(ShippingType),
			cost: z.number().nonnegative(),
			pickupPoint: z.object({
				// Define fields if needed, or allow loose object if strict validation isn't critical here yet
				// Assuming basics:
				_id: z.string().optional(),
				name: z.string().optional(),
				address: z.string().optional()
			}).optional(),
		}),
		
		paymentMethod: z.object({
			_id: z.string().min(1),
			type: z.nativeEnum(PaymentType)
		})
	})
});

export const UpdatePaymentStatusSchema = z.object({
	body: z.object({
		orderID: z.string().min(1),
		status: z.enum(PaymentStatus)
	})
});

export const UpdateShippingStatusSchema = z.object({
	body: z.object({
		orderID: z.string().min(1),
		status: z.enum(OrderStatus)
	})
});
