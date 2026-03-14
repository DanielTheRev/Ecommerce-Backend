import { z } from 'zod';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { OrderStatus, PaymentStatus } from '@/interfaces/order.interface';

const CartItemSchema = z.object({
	_id: z.string().min(1),
	sku: z.string().optional(), // Adding this since DTO has it, but making it optional since payload lacks it
	quantity: z.number().int().positive(),
});

// Create Order Schema
export const CreateOrderSchema = z.object({
	body: z.object({
		items: z.array(CartItemSchema).min(1, 'Order must have at least one item'),
		shippingMethod: z.object({
			_id: z.string().min(1),
			type: z.enum(ShippingType),
			cost: z.number().nonnegative(),
			pickupPoint: z.object({
				_id: z.string().optional(),
				name: z.string().optional(),
				address: z.string().optional()
			}).optional(),
		}),

		paymentMethod: z.object({
			_id: z.string().min(1),
			type: z.enum(PaymentType)
		}),

		mercadopagoData: z.object({
			token: z.string().optional(),
			payment_method_id: z.string(),
			installments: z.number().int().positive(),
			type: z.string(),
			payer: z.object({
				email: z.string().email(),
				first_name: z.string().optional(),
				last_name: z.string().optional()
			}).optional(),
			identification: z.object({
				type: z.string(),
				number: z.string()
			}).optional()
		}).optional()
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
