import { z } from 'zod';
import { ClothingFit, ClothingGender, ClothingSizeType, IProductCategories, ProductType } from '@/interfaces/product.interface';

// Helpers para z.enum() a partir de los enums de dominio
const genderValues = Object.values(ClothingGender) as [string, ...string[]];
const fitValues = Object.values(ClothingFit) as [string, ...string[]];
const sizeTypeValues = Object.values(ClothingSizeType) as [string, ...string[]];

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
		productType: z.enum(ProductType),
		brand: z.string().min(1, 'Brand is required').max(200),
		model: z.string().min(1, 'Model is required').max(200),
		category: z.enum(IProductCategories),
		shortDescription: z.string().min(1, 'Short description is required'),
		largeDescription: z.string().min(1, 'Large description is required'),
		price: z.string().or(z.number()).transform(v => Number(v)).refine(v => v > 0, 'Price must be positive'),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		discount: z.string().or(z.number()).transform(v => Number(v)).default(0),

		features: jsonString.pipe(z.array(z.string())),
		specifications: jsonString.pipe(z.array(SpecSchema)),
		variants: jsonString.pipe(z.array(VariantZodSchema)).default([]),
		tags: jsonString.pipe(z.array(z.string())).optional(),

		// Tech-specific (opcionales)
		storage: jsonString.pipe(z.array(z.string())).optional(),
		ram: z.string().optional(),
		processor: z.string().optional(),
		screenSize: z.string().optional(),
		os: z.string().optional(),

		// Clothing-specific (opcionales)
		gender: z.enum(genderValues).optional(),
		fit: z.enum(fitValues).optional(),
		material: z.string().optional(),
		sizeType: z.enum(sizeTypeValues).optional(),
		composition: jsonString.pipe(z.array(z.object({
			material: z.string().min(1),
			percentage: z.number().min(0).max(100)
		}))).optional(),
		careInstructions: jsonString.pipe(z.array(z.string())).optional(),

		// SEO (og_image llega como archivo separado, no se valida aquí)
		seo: jsonString.pipe(z.object({
			metaDescription: z.string().optional(),
			metaTitle: z.string().optional(),
		})).optional(),
	})
});

// Update Product Schema
export const UpdateProductSchema = z.object({
	body: z.object({
		productType: z.enum(ProductType).optional(),
		brand: z.string().max(200).optional(),
		model: z.string().max(200).optional(),
		category: z.enum(IProductCategories).optional(),
		shortDescription: z.string().optional(),
		largeDescription: z.string().optional(),
		price: z.string().or(z.number()).transform(v => Number(v)).optional(),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		discount: z.string().or(z.number()).transform(v => Number(v)).optional(),
		deletedImages: z.string().optional(),

		features: jsonString.pipe(z.array(z.string())).optional(),
		specifications: jsonString.pipe(z.array(SpecSchema)).optional(),
		variants: jsonString.pipe(z.array(VariantZodSchema)).optional(),
		tags: jsonString.pipe(z.array(z.string())).optional(),

		// Tech-specific
		storage: jsonString.pipe(z.array(z.string())).optional(),
		ram: z.string().optional(),
		processor: z.string().optional(),
		screenSize: z.string().optional(),
		os: z.string().optional(),

		// Clothing-specific
		gender: z.enum(genderValues).optional(),
		fit: z.enum(fitValues).optional(),
		material: z.string().optional(),
		sizeType: z.enum(sizeTypeValues).optional(),
		composition: jsonString.pipe(z.array(z.object({
			material: z.string().min(1),
			percentage: z.number().min(0).max(100)
		}))).optional(),
		careInstructions: jsonString.pipe(z.array(z.string())).optional(),

		// SEO (og_image llega como archivo separado, no se valida aquí)
		seo: jsonString.pipe(z.object({
			metaTitle: z.string().optional(),
			metaDescription: z.string().optional(),
		})).optional(),

		// Para borrar la og_image existente
		deletedSeoOgImage: z.string().optional(),
		isActive: z.string().or(z.boolean()).transform(v => v === 'true' || v === true).optional(),
		isFeatured: z.string().or(z.boolean()).transform(v => v === 'true' || v === true).optional(),
	})
});

// Price Calculator Schema (actualizado con customProfitMargin)
export const PriceCalculatorSchema = z.object({
	body: z.object({
		costPrice: z.number().positive('Cost price must be positive'),
		revenuePercentage: z.number().optional(),
		cft: z.number().optional(),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional()
	})
});
