import { z } from 'zod';

export const createAddressSchema = z.object({
	body: z.object({
		alias: z.string().min(1, 'El alias es requerido'),
		recipientName: z.string().min(1, 'El nombre del destinatario es requerido'),
		street: z.string().min(1, 'La calle es requerida'),
		number: z.string().min(1, 'El número es requerido'),
		apartment: z.string().optional(),
		city: z.string().min(1, 'La ciudad es requerida'),
		state: z.string().min(1, 'La provincia/estado es requerido'),
		zipCode: z.string().min(1, 'El código postal es requerido'),
		phone: z.string().min(1, 'El teléfono es requerido'),
		isDefault: z.boolean().optional()
	})
});

export const updateAddressSchema = z.object({
	body: createAddressSchema.shape.body.partial(),
	params: z.object({
		id: z.string().min(1, 'El ID de la dirección es requerido')
	})
});
