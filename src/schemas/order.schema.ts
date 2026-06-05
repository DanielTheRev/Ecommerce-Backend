import { z } from 'zod';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import { OrderStatus, PaymentStatus } from '@/interfaces/order.interface';
import { ARGENTINA_PROVINCE_NAMES } from '@/utils/provinces';

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
			}).optional().nullable(),
			address: z.object({
				recipientName: z.string().min(1, 'El nombre del destinatario es requerido'),
				street: z.string().min(1, 'La calle es requerida'),
				number: z.string().min(1, 'El número es requerido'),
				apartment: z.string().optional().nullable().or(z.literal('')),
				city: z.string().min(1, 'La ciudad es requerida'),
				state: z.string().min(1, 'La provincia es requerida').refine(
					(val) => ARGENTINA_PROVINCE_NAMES.includes(val),
					{ message: 'La provincia ingresada no es válida' }
				),
				zipCode: z.string().min(1, 'El código postal es requerido'),
				phone: z.string().min(1, 'El teléfono es requerido')
			}).optional().nullable()
		}),

		paymentMethod: z.object({
			_id: z.string().min(1),
			type: z.enum(PaymentType)
		}),

		formPayerData: z.object({
			firstName: z.string(),
			lastName: z.string(),
			email: z.string().email(),
			identificationType: z.string().min(1).optional(),
			identificationNumber: z.string().min(1).optional()
		}),

		mercadopagoData: z.object({
			token: z.string().optional(),
			payment_method_id: z.string(),
			installments: z.number().int().positive().optional(),
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
}).refine(
	(data) => {
		if (data.body.shippingMethod.type === ShippingType.HOME_DELIVERY) {
			return !!data.body.shippingMethod.address;
		}
		return true;
	},
	{
		message: 'La dirección de envío es requerida para envíos a domicilio',
		path: ['body', 'shippingMethod', 'address']
	}
);

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

export const TrackOrderSchema = z.object({
	query: z.object({
		orderNumber: z.string().min(1, 'Se requiere el número de orden'),
		email: z.string().email('Debe ser un email válido')
	})
});

export const PayOrderSchema = z.object({
	params: z.object({
		id: z.string().min(1, 'Se requiere el ID de la orden')
	}),
	body: z.object({
		mercadopagoData: z.object({
			token: z.string().optional(),
			payment_method_id: z.string(),
			installments: z.number().int().positive().optional(),
			type: z.string(),
			payer: z.object({
				email: z.email(),
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
