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

const optionalJsonString = z.string().optional().transform((str, ctx) => {
	if (!str || str.trim() === '') return undefined;
	try {
		return JSON.parse(str);
	} catch (e) {
		ctx.addIssue({ code: 'custom', message: 'Invalid JSON string' });
		return z.NEVER;
	}
});

// Size Guide Schemas
const SizeGuideRowSchema = z.object({
	size: z.string().min(1, 'El talle es requerido'),
	values: z.array(z.string()).min(1, 'Se requiere al menos un valor de medida')
});

const SizeGuideZodSchema = z.object({
	headers: z.array(z.string().min(1)).min(2, 'Se requieren al menos 2 encabezados (talle + una medida)'),
	rows: z.array(SizeGuideRowSchema).min(1, 'Se requiere al menos una fila'),
	tolerance: z.string().optional()
}).refine(data => {
	const expectedValues = data.headers.length - 1; // first header is for the size column
	return data.rows.every(row => row.values.length === expectedValues);
}, {
	message: 'La cantidad de valores en cada fila debe coincidir con la cantidad de encabezados (sin contar el talle)'
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
	imageIndex: z.coerce.number().int().min(0).optional().nullable(),
});

// Tech Variant Schema (Electromix) — attributes opcional, sin size
const TechVariantZodSchema = z.object({
	sku: z.string().optional(),
	attributes: z.array(z.object({
		key: z.string().min(1),
		value: z.string().min(1)
	})).default([]),
	color: VariantColorSchema.optional(),
	stock: z.number().int().min(0).default(0),
	reservedStock: z.number().int().min(0).default(0),
	isActive: z.boolean().default(true),
	imageReference: z.object({
		url: z.string(),
		public_id: z.string()
	}).optional(),
	barcode: z.string().optional(),
	imageIndex: z.coerce.number().int().min(0).optional().nullable(),
});

// General / Beauty Variant Schema
const GeneralVariantZodSchema = z.object({
	_id: z.string().optional(),
	sku: z.string().optional(),
	size: z.string().optional(),
	volume: z.string().optional(),
	color: VariantColorSchema.optional(),
	stock: z.coerce.number().int().min(0).default(0),
	reservedStock: z.coerce.number().int().min(0).default(0),
	isActive: z.coerce.boolean().default(true),
	imageReference: z.object({
		url: z.string(),
		public_id: z.string()
	}).optional(),
	barcode: z.string().optional(),
	imageIndex: z.coerce.number().int().min(0).optional().nullable(),
});

// ============ BASE PRODUCT FIELDS ============
const BaseProductFields = {
	provider: z.string().optional(),
	linkProductProvider: z.string().optional(),
	brand: z.string().min(1, 'Brand is required').max(200),
	model: z.string().min(1, 'Model is required').max(200),
	category: z.string().min(1, 'Category is required'),
	price: z.string().or(z.number()).transform(v => Number(v)).optional(),
	providerCost: z.string().or(z.number()).transform(v => Number(v)).optional(),
	useCustomProfit: z.string().or(z.boolean()).transform(v => typeof v === 'string' ? v === 'true' : Boolean(v)).optional(),
	pricingMethodChoice: z.enum(['markup', 'margin']).optional(),
	customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
	customProfitMargin1Pay: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
	customProfitMarginInstallments: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
	discount: z.string().or(z.number()).transform(v => Number(v)).default(0),
	tags: optionalJsonString.pipe(z.array(z.string()).optional()),
	seo: optionalJsonString.pipe(z.object({
		metaDescription: z.string().optional(),
		metaTitle: z.string().optional(),
	}).optional()),
	status: z.enum(['published', 'draft', 'paused', 'archived']).default('draft').optional(),
	isFeatured: z.string().or(z.boolean()).transform(v => v === 'true' || v === true).optional(),
};

// 1. General Product Schema (Kioscos, Almacén, Bazar - Ultra Liviano)
export const GeneralProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.literal(ProductType.GENERAL),
	shortDescription: z.string().optional().default(''),
	largeDescription: z.string().optional().default(''),
	barcode: z.string().optional(),
	isSoldByWeight: z.string().or(z.boolean()).transform(v => typeof v === 'string' ? v === 'true' : Boolean(v)).optional().default(false),
	unit: z.string().optional().default('Unidad'),
	weight: z.string().optional(),
	features: optionalJsonString.pipe(z.array(z.string()).optional()).default([]),
	specifications: optionalJsonString.pipe(z.array(SpecSchema).optional()).default([]),
	variants: optionalJsonString.pipe(z.array(GeneralVariantZodSchema).optional()).default([]),
});

// 2. Clothing Product Schema (Indumentaria / Moda - Vura - Estricto)
export const ClothingProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.literal(ProductType.CLOTHING),
	shortDescription: z.string().min(1, 'Short description is required'),
	largeDescription: z.string().min(1, 'Large description is required'),
	features: optionalJsonString.pipe(z.array(z.string()).optional()).default([]),
	specifications: optionalJsonString.pipe(z.array(SpecSchema).optional()).default([]),
	variants: jsonString.pipe(z.array(ClothingVariantZodSchema)).default([]),
	gender: z.string().optional(),
	fit: z.string().optional(),
	material: z.string().optional(),
	sizeType: z.enum(sizeTypeValues).optional(),
	composition: optionalJsonString.pipe(z.array(z.object({
		material: z.string().min(1),
		percentage: z.number().min(0).max(100)
	})).optional()),
	sizeGuide: optionalJsonString.pipe(SizeGuideZodSchema.optional()),
	careInstructions: optionalJsonString.pipe(z.array(z.string())).optional(),
	season: z.string().optional(),
});

// 3. Tech Product Schema (Electrónica / Tecnología)
export const TechProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.literal(ProductType.TECH),
	shortDescription: z.string().min(1, 'Short description is required'),
	largeDescription: z.string().min(1, 'Large description is required'),
	features: optionalJsonString.pipe(z.array(z.string()).optional()).default([]),
	specifications: optionalJsonString.pipe(z.array(SpecSchema).optional()).default([]),
	variants: jsonString.pipe(z.array(TechVariantZodSchema)).default([]),
	storage: optionalJsonString.pipe(z.array(z.string())).optional(),
	ram: z.string().optional(),
	processor: z.string().optional(),
	screenSize: z.string().optional(),
	os: z.string().optional(),
});

// 4. Beauty Product Schema (Cosmética / Perfumería)
export const BeautyProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.literal(ProductType.BEAUTY),
	shortDescription: z.string().min(1, 'Short description is required'),
	largeDescription: z.string().min(1, 'Large description is required'),
	features: optionalJsonString.pipe(z.array(z.string()).optional()).default([]),
	specifications: optionalJsonString.pipe(z.array(SpecSchema).optional()).default([]),
	variants: optionalJsonString.pipe(z.array(GeneralVariantZodSchema).optional()).default([]),
	volume: z.string().optional(),
	concentration: z.string().optional(),
	fragranceFamily: z.string().optional(),
	scentNotes: optionalJsonString.pipe(z.object({
		top: z.string().optional(),
		heart: z.string().optional(),
		base: z.string().optional()
	}).optional()),
	applicationArea: z.string().optional(),
});

export const CreateProductBodySchema = z.discriminatedUnion('productType', [
	GeneralProductCreateSchema,
	ClothingProductCreateSchema,
	TechProductCreateSchema,
	BeautyProductCreateSchema
]).superRefine((data, ctx) => {
	const cost = data.providerCost ?? data.price;
	if (cost === undefined || cost <= 0 || isNaN(cost)) {
		ctx.addIssue({
			code: 'custom',
			path: ['providerCost'],
			message: 'El costo del proveedor (providerCost) es requerido y debe ser mayor a 0'
		});
	}

	if (data.productType === ProductType.CLOTHING && Array.isArray(data.variants)) {
		data.variants.forEach((v: any, i: number) => {
			if (!v.size) ctx.addIssue({
				code: 'custom',
				path: ['variants', i, 'size'],
				message: 'El talle (size) es requerido para productos de indumentaria'
			});
		});
	}
});

// Create Product Schema
export const CreateProductSchema = z.object({
	body: CreateProductBodySchema
});

// Update Product Schema
export const UpdateProductSchema = z.object({
	body: z.object({
		productType: z.enum(ProductType).optional(),
		provider: z.string().optional(),
		linkProductProvider: z.string().optional(),
		brand: z.string().max(200).optional(),
		model: z.string().max(200).optional(),
		category: z.string().optional(),
		shortDescription: z.string().optional(),
		largeDescription: z.string().optional(),
		price: z.string().or(z.number()).transform(v => Number(v)).optional(),
		providerCost: z.string().or(z.number()).transform(v => Number(v)).optional(),
		useCustomProfit: z.string().or(z.boolean()).transform(v => typeof v === 'string' ? v === 'true' : Boolean(v)).optional(),
		pricingMethodChoice: z.enum(['markup', 'margin']).optional(),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMargin1Pay: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMarginInstallments: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		discount: z.string().or(z.number()).transform(v => Number(v)).optional(),
		deletedImages: z.string().optional(),

		features: jsonString.pipe(z.array(z.string())).optional(),
		specifications: jsonString.pipe(z.array(SpecSchema)).optional(),
		variants: jsonString.pipe(
			z.array(z.union([ClothingVariantZodSchema, TechVariantZodSchema, GeneralVariantZodSchema]))
		).optional(),
		tags: jsonString.pipe(z.array(z.string())).optional(),

		// Tech-specific
		storage: jsonString.pipe(z.array(z.string())).optional(),
		ram: z.string().optional(),
		processor: z.string().optional(),
		screenSize: z.string().optional(),
		os: z.string().optional(),

		// Clothing-specific
		gender: z.string().optional(),
		fit: z.string().optional(),
		material: z.string().optional(),
		sizeType: z.enum(sizeTypeValues).optional(),
		composition: jsonString.pipe(z.array(z.object({
			material: z.string().min(1),
			percentage: z.number().min(0).max(100)
		}))).optional(),
		sizeGuide: jsonString.pipe(SizeGuideZodSchema.nullable()).optional(),
		careInstructions: jsonString.pipe(z.array(z.string())).optional(),
		season: z.string().optional(),

		// Beauty-specific
		volume: z.string().optional(),
		concentration: z.string().optional(),
		fragranceFamily: z.string().optional(),
		scentNotes: jsonString.pipe(z.object({
			top: z.string().optional(),
			heart: z.string().optional(),
			base: z.string().optional()
		})).optional().or(z.object({
			top: z.string().optional(),
			heart: z.string().optional(),
			base: z.string().optional()
		})).optional(),
		applicationArea: z.string().optional(),

		// General-specific
		barcode: z.string().optional(),
		isSoldByWeight: z.string().or(z.boolean()).transform(v => typeof v === 'string' ? v === 'true' : Boolean(v)).optional(),
		unit: z.string().optional(),
		weight: z.string().optional(),

		// SEO (og_image llega como archivo separado, no se valida aquí)
		seo: jsonString.pipe(z.object({
			metaTitle: z.string().optional(),
			metaDescription: z.string().optional(),
		})).optional(),

		// Para borrar la og_image existente
		deletedSeoOgImage: z.string().optional(),
		status: z.enum(['published', 'draft', 'paused', 'archived']).optional(),
		isFeatured: z.string().or(z.boolean()).transform(v => v === 'true' || v === true).optional(),
	}).superRefine((data, ctx) => {
		if (data.providerCost !== undefined && (data.providerCost <= 0 || isNaN(data.providerCost))) {
			ctx.addIssue({
				code: 'custom',
				path: ['providerCost'],
				message: 'El costo del proveedor (providerCost) debe ser mayor a 0'
			});
		}
		if (data.price !== undefined && (data.price <= 0 || isNaN(data.price))) {
			ctx.addIssue({
				code: 'custom',
				path: ['price'],
				message: 'El precio debe ser mayor a 0'
			});
		}

		if (data.productType === 'ClothingProduct' && Array.isArray(data.variants)) {
			data.variants.forEach((v: any, i: number) => {
				if (!v.size) ctx.addIssue({
					code: 'custom',
					path: ['variants', i, 'size'],
					message: 'El talle (size) es requerido para productos de indumentaria'
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
