import { z } from 'zod';
import { IProductCategories } from '@/interfaces/product.interface';

// Helper for parsing JSON strings from multipart/form-data
const jsonString = z.string().transform((str, ctx) => {
	try {
		return JSON.parse(str);
	} catch (e) {
		ctx.addIssue({ code: 'custom', message: 'Invalid JSON string' });
		return z.NEVER;
	}
});

// Spec Schema
const SpecSchema = z.object({
	key: z.string().min(1, 'Key is required'),
	value: z.string().min(1, 'Value is required')
});

// Base Product Schema
export const CreateProductSchema = z.object({
	body: z.object({
		brand: z.string().min(1, 'Brand is required').max(200),
		model: z.string().min(1, 'Model is required').max(200),
		category: z.enum(IProductCategories),
		shortDescription: z.string().min(1, 'Short description is required'),
		largeDescription: z.string().min(1, 'Large description is required'),
		price: z.string().or(z.number()).transform(v => Number(v)).refine(v => v > 0, 'Price must be positive'),
		discount: z.string().or(z.number()).transform(v => Number(v)).default(0),
		stock: z.string().or(z.number()).transform(v => Number(v)).default(0),

		// Arrays that come as JSON strings in data-form
		features: jsonString.pipe(z.array(z.string())),
		colors: jsonString.pipe(z.array(z.string())),
		storage: jsonString.pipe(z.array(z.string())),
		specifications: jsonString.pipe(z.array(SpecSchema))
	})
});

export const UpdateProductSchema = z.object({
	body: z.object({
		brand: z.string().max(200).optional(),
		model: z.string().max(200).optional(),
		category: z.enum(IProductCategories).optional(),
		shortDescription: z.string().optional(),
		largeDescription: z.string().optional(),
		price: z.string().or(z.number()).transform(v => Number(v)).optional(),
		discount: z.string().or(z.number()).transform(v => Number(v)).optional(),
		stock: z.string().or(z.number()).transform(v => Number(v)).optional(),
		deletedImages: z.string().optional(), // JSON string array

		features: jsonString.pipe(z.array(z.string())).optional(),
		colors: jsonString.pipe(z.array(z.string())).optional(),
		storage: jsonString.pipe(z.array(z.string())).optional(),
		specifications: jsonString.pipe(z.array(SpecSchema)).optional()
	})
});

export const PriceCalculatorSchema = z.object({
	body: z.object({
		costPrice: z.number().positive('Cost price must be positive'),
		revenuePercentage: z.number().optional(),
		cft: z.number().optional()
	})
});
