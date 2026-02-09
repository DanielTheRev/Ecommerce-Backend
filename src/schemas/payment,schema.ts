import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { z } from 'zod';


export const createPaymentSchema = z.object({
	type: z.enum(PaymentType),
	name: z.string(),
	description: z.string().optional(),
	isActive: z.boolean().optional().default(true),
})

export const updatePaymentSchema = z.object({
	type: z.enum(PaymentType).optional(),
	name: z.string().optional(),
	description: z.string().optional(),
	isActive: z.boolean().optional(),
})