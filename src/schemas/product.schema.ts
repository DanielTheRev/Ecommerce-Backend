import { ClothingFit, ClothingGender, ClothingSizeType, ProductType } from '@/interfaces/product.interface';
import { z } from 'zod';

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

// Variant Color Schema (compartido)
const VariantColorSchema = z.object({
	name: z.string().min(1),
	hex: z.string().min(1)
});

// Clothing Variant Schema (Vura) — size requerido, sin attributes
const ClothingVariantZodSchema = z.object({
	sku: z.string().optional(),
	size: z.string().min(1, 'El talle es requerido'),
	color: VariantColorSchema.optional(),
	stock: z.number().int().min(0).default(0),
	reservedStock: z.number().int().min(0).default(0),
	isActive: z.boolean().default(true),
	imageReference: z.object({
		url: z.string(),
		public_id: z.string()
	}).optional(),
	barcode: z.string().optional(),
	imageIndex: z.number().int().min(0).optional().nullable(),
});

// Tech Variant Schema (Electromix) — attributes requerido, sin size
const TechVariantZodSchema = z.object({
	sku: z.string().optional(),
	attributes: z.array(z.object({
		key: z.string().min(1),
		value: z.string().min(1)
	})).min(1, 'Al menos un atributo es requerido por variante tech'),
	color: VariantColorSchema.optional(),
	stock: z.number().int().min(0).default(0),
	reservedStock: z.number().int().min(0).default(0),
	isActive: z.boolean().default(true),
	imageReference: z.object({
		url: z.string(),
		public_id: z.string()
	}).optional(),
	barcode: z.string().optional(),
	imageIndex: z.number().int().min(0).optional().nullable(),
});

// Create Product Schema
export const CreateProductSchema = z.object({
	body: z.object({
		productType: z.enum(ProductType),
		provider: z.string().optional(),
		brand: z.string().min(1, 'Brand is required').max(200),
		model: z.string().min(1, 'Model is required').max(200),
		category: z.string(),
		shortDescription: z.string().min(1, 'Short description is required'),
		largeDescription: z.string().min(1, 'Large description is required'),
		price: z.string().or(z.number()).transform(v => Number(v)).refine(v => v > 0, 'Price must be positive'),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMargin1Pay: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMarginInstallments: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		discount: z.string().or(z.number()).transform(v => Number(v)).default(0),

		features: jsonString.pipe(z.array(z.string())),
		specifications: jsonString.pipe(z.array(SpecSchema)),
		variants: jsonString.pipe(
			z.array(z.union([ClothingVariantZodSchema, TechVariantZodSchema]))
		).default([]),
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
	}).superRefine((data, ctx) => {
		if (data.productType === 'ClothingProduct' && Array.isArray(data.variants)) {
			data.variants.forEach((v: any, i: number) => {
				if (!v.size) ctx.addIssue({
					code: 'custom',
					path: ['variants', i, 'size'],
					message: 'El talle (size) es requerido para productos de indumentaria'
				});
			});
		}
		if (data.productType === 'TechProduct' && Array.isArray(data.variants)) {
			data.variants.forEach((v: any, i: number) => {
				if (!v.attributes?.length) ctx.addIssue({
					code: 'custom',
					path: ['variants', i, 'attributes'],
					message: 'Los atributos son requeridos para productos tech'
				});
			});
		}
	})
});

// Update Product Schema
export const UpdateProductSchema = z.object({
	body: z.object({
		productType: z.enum(ProductType).optional(),
		provider: z.string().optional(),
		brand: z.string().max(200).optional(),
		model: z.string().max(200).optional(),
		category: z.string().optional(),
		shortDescription: z.string().optional(),
		largeDescription: z.string().optional(),
		price: z.string().or(z.number()).transform(v => Number(v)).optional(),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMargin1Pay: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMarginInstallments: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		discount: z.string().or(z.number()).transform(v => Number(v)).optional(),
		deletedImages: z.string().optional(),

		features: jsonString.pipe(z.array(z.string())).optional(),
		specifications: jsonString.pipe(z.array(SpecSchema)).optional(),
		variants: jsonString.pipe(
			z.array(z.union([ClothingVariantZodSchema, TechVariantZodSchema]))
		).optional(),
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
		season: z.string().optional(),

		// SEO (og_image llega como archivo separado, no se valida aquí)
		seo: jsonString.pipe(z.object({
			metaTitle: z.string().optional(),
			metaDescription: z.string().optional(),
		})).optional(),

		// Para borrar la og_image existente
		deletedSeoOgImage: z.string().optional(),
		isActive: z.string().or(z.boolean()).transform(v => v === 'true' || v === true).optional(),
		isFeatured: z.string().or(z.boolean()).transform(v => v === 'true' || v === true).optional(),
	}).superRefine((data, ctx) => {
		if (data.productType === 'ClothingProduct' && Array.isArray(data.variants)) {
			data.variants.forEach((v: any, i: number) => {
				if (!v.size) ctx.addIssue({
					code: 'custom',
					path: ['variants', i, 'size'],
					message: 'El talle (size) es requerido para productos de indumentaria'
				});
			});
		}
		if (data.productType === 'TechProduct' && Array.isArray(data.variants)) {
			data.variants.forEach((v: any, i: number) => {
				if (!v.attributes?.length) ctx.addIssue({
					code: 'custom',
					path: ['variants', i, 'attributes'],
					message: 'Los atributos son requeridos para productos tech'
				});
			});
		}
	})
});

// Price Calculator Schema (actualizado con customProfitMargin)
export const PriceCalculatorSchema = z.object({
	body: z.object({
		costPrice: z.number().positive('Cost price must be positive'),
		revenuePercentage: z.number().optional(),
		cft: z.number().optional(),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMargin1Pay: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMarginInstallments: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional()
	})
});
