import { z } from 'zod';
import { IProductCategories, ProductType } from '@/interfaces/product.interface';

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

// Variant Attribute Schema
const VariantAttributeSchema = z.object({
	key: z.string().min(1),
	value: z.string().min(1)
});

// Variant Color Schema
const VariantColorSchema = z.object({
	name: z.string().min(1),
	hex: z.string().min(1)
});

// Variant Schema
const VariantZodSchema = z.object({
	sku: z.string().min(1, 'SKU es requerido'),
	attributes: z.array(VariantAttributeSchema).min(1, 'Al menos un atributo por variante'),
	color: VariantColorSchema.optional(),
	stock: z.number().int().min(0).default(0),
	reservedStock: z.number().int().min(0).default(0),
	isActive: z.boolean().default(true),
	images: z.array(z.object({
		url: z.string(),
		public_id: z.string()
	})).default([]),
	barcode: z.string().optional()
});

// Create Product Schema
export const CreateProductSchema = z.object({
	body: z.object({
		productType: z.nativeEnum(ProductType),
		brand: z.string().min(1, 'Brand is required').max(200),
		model: z.string().min(1, 'Model is required').max(200),
		category: z.nativeEnum(IProductCategories),
		shortDescription: z.string().min(1, 'Short description is required'),
		largeDescription: z.string().min(1, 'Large description is required'),
		price: z.string().or(z.number()).transform(v => Number(v)).refine(v => v > 0, 'Price must be positive'),
		discount: z.string().or(z.number()).transform(v => Number(v)).default(0),

		// Arrays that come as JSON strings in form-data
		features: jsonString.pipe(z.array(z.string())),
		specifications: jsonString.pipe(z.array(SpecSchema)),
		variants: jsonString.pipe(z.array(VariantZodSchema)).default([]),

		// Tech-specific (opcionales)
		storage: jsonString.pipe(z.array(z.string())).optional(),
		ram: z.string().optional(),
		processor: z.string().optional(),
		screenSize: z.string().optional(),
		os: z.string().optional(),

		// Clothing-specific (opcionales)
		gender: z.enum(['Hombre', 'Mujer', 'Unisex', 'Niños']).optional(),
		fit: z.enum(['Regular', 'Slim', 'Oversized', 'Relaxed']).optional(),
		material: z.string().optional(),
		sizeType: z.enum(['Ropa', 'Calzado', 'Numérico']).optional(),
		composition: jsonString.pipe(z.array(z.object({
			material: z.string().min(1),
			percentage: z.number().min(0).max(100)
		}))).optional(),
		careInstructions: jsonString.pipe(z.array(z.string())).optional(),
	})
});

// Update Product Schema
export const UpdateProductSchema = z.object({
	body: z.object({
		productType: z.nativeEnum(ProductType).optional(),
		brand: z.string().max(200).optional(),
		model: z.string().max(200).optional(),
		category: z.nativeEnum(IProductCategories).optional(),
		shortDescription: z.string().optional(),
		largeDescription: z.string().optional(),
		price: z.string().or(z.number()).transform(v => Number(v)).optional(),
		discount: z.string().or(z.number()).transform(v => Number(v)).optional(),
		deletedImages: z.string().optional(),

		features: jsonString.pipe(z.array(z.string())).optional(),
		specifications: jsonString.pipe(z.array(SpecSchema)).optional(),
		variants: jsonString.pipe(z.array(VariantZodSchema)).optional(),

		// Tech-specific
		storage: jsonString.pipe(z.array(z.string())).optional(),
		ram: z.string().optional(),
		processor: z.string().optional(),
		screenSize: z.string().optional(),
		os: z.string().optional(),

		// Clothing-specific
		gender: z.enum(['Hombre', 'Mujer', 'Unisex', 'Niños']).optional(),
		fit: z.enum(['Regular', 'Slim', 'Oversized', 'Relaxed']).optional(),
		material: z.string().optional(),
		sizeType: z.enum(['Ropa', 'Calzado', 'Numérico']).optional(),
		composition: jsonString.pipe(z.array(z.object({
			material: z.string().min(1),
			percentage: z.number().min(0).max(100)
		}))).optional(),
		careInstructions: jsonString.pipe(z.array(z.string())).optional(),
	})
});

// Price Calculator Schema (sin cambios)
export const PriceCalculatorSchema = z.object({
	body: z.object({
		costPrice: z.number().positive('Cost price must be positive'),
		revenuePercentage: z.number().optional(),
		cft: z.number().optional()
	})
});
