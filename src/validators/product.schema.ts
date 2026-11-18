import { ClothingFit, ClothingGender, ClothingSizeType, ProductType } from '@/interfaces/product.interface';
import { z } from 'zod';

// Helpers para z.enum() a partir de los enums de dominio
const genderValues = Object.values(ClothingGender) as [string, ...string[]];
const fitValues = Object.values(ClothingFit) as [string, ...string[]];
const sizeTypeValues = Object.values(ClothingSizeType) as [string, ...string[]];

// Helper for parsing JSON strings from multipart/form-data
const jsonString = z.unknown().transform((val, ctx) => {
	if (typeof val === 'string') {
		try {
			return JSON.parse(val);
		} catch (e) {
			ctx.addIssue({ code: 'custom', message: 'Invalid JSON string' });
			return z.NEVER;
		}
	}
	return val;
});

const optionalJsonString = z.unknown().optional().transform((val, ctx) => {
	if (val === undefined || val === null || val === '') return undefined;
	if (typeof val === 'string') {
		try {
			return JSON.parse(val);
		} catch (e) {
			ctx.addIssue({ code: 'custom', message: 'Invalid JSON string' });
			return z.NEVER;
		}
	}
	return val;
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
	value: z.string().min(1, 'Value is required'),
	isFeatured: z.boolean().optional().default(false)
});

// Variant Color Schema (compartido)
const VariantColorSchema = z.object({
	name: z.string().min(1),
	hex: z.string().min(1)
});

// Clothing Variant Schema — size requerido, sin attributes
const ClothingVariantZodSchema = z.object({
	sku: z.string().optional(),
	size: z.string().min(1, 'El talle es requerido'),
	color: VariantColorSchema.optional(),
	stock: z.number().int().min(0).default(0),
	reservedStock: z.number().int().min(0).default(0),
	price: z.coerce.number().min(0).optional(),
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
	price: z.coerce.number().min(0).optional(),
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
	price: z.coerce.number().min(0).optional(),
	isActive: z.coerce.boolean().default(true),
	imageReference: z.object({
		url: z.string(),
		public_id: z.string()
	}).optional(),
	barcode: z.string().optional(),
	imageIndex: z.coerce.number().int().min(0).optional().nullable(),
});

// Universal Variant Schema (soporta talles, medidas, litros, packs, atributos clave-valor y precios/margen custom)
export const UniversalVariantZodSchema = z.object({
	_id: z.string().optional(),
	sku: z.string().optional(),
	label: z.string().trim().optional(),
	size: z.string().optional(),
	volume: z.string().optional(),
	attributes: z.array(z.object({
		key: z.string().min(1),
		value: z.string().min(1)
	})).optional().default([]),
	color: VariantColorSchema.optional(),
	stock: z.coerce.number().min(0).default(0), // Permite decimales para weighable (kg, l)
	reservedStock: z.coerce.number().min(0).default(0),
	price: z.coerce.number().min(0).optional(),
	inheritPrice: z.coerce.boolean().optional().default(true),
	providerCost: z.coerce.number().min(0).optional(),
	profitMargin: z.coerce.number().min(0).optional(),
	prices: z.record(z.string(), z.unknown()).optional(),
	isActive: z.coerce.boolean().default(true),
	// [REMOVE-BEFORE-PROD]: legacy imageReference / imageIndex
	imageReference: z.object({
		url: z.string(),
		public_id: z.string()
	}).optional(),
	barcode: z.string().optional(),
	imageIndex: z.coerce.number().int().min(0).optional().nullable(),
});

const ExtraCostConceptZodSchema = z.object({
	concept: z.string().min(1),
	value: z.coerce.number().min(0),
	type: z.enum(['fixed', 'percent_over_provider', 'percent_over_price']),
	category: z.enum(['expense', 'tax', 'shipping']).optional()
});

const ChannelRuleZodSchema = z.object({
	enabled: z.boolean().optional(),
	mode: z.enum(['auto', 'linked', 'discount_from_list', 'fixed']),
	linkedTo: z.enum(['cash', 'transfer', 'qr', 'debit', 'credit1Pay', 'list']).optional(),
	discountPercent: z.coerce.number().min(0).max(99.9).optional(),
	fixedPrice: z.coerce.number().min(0).optional(),
	inheritCosts: z.boolean().optional(),
	excludedCostConcepts: z.array(z.string()).optional(),
	extraCosts: z.array(ExtraCostConceptZodSchema).optional()
});

const ChannelPricingZodSchema = z.object({
	cash: ChannelRuleZodSchema.optional(),
	transfer: ChannelRuleZodSchema.optional(),
	qr: ChannelRuleZodSchema.optional(),
	debit: ChannelRuleZodSchema.optional(),
	credit1Pay: ChannelRuleZodSchema.optional(),
	list: ChannelRuleZodSchema.optional()
});

const PaymentRestrictionsZodSchema = z.object({
	allowCardPayment: z.boolean().default(true),
	allowInterestFreeInstallments: z.boolean().default(true),
	maxInstallments: z.coerce.number().int().min(1).max(18).optional()
});

// ============ BASE PRODUCT FIELDS ============
const BaseProductFields = {
	name: z.string().max(250).optional(),
	provider: z.string().optional(),
	linkProductProvider: z.string().optional(),
	brand: z.string().max(200).optional(),
	model: z.string().max(200).optional(),
	subtitle: z.string().max(200).optional(),
	category: z.string().min(1, 'Category is required'),
	netStock: z.string().or(z.number()).transform(v => Number(v)).optional(),
	lowStockThreshold: z.string().or(z.number()).transform(v => Number(v)).optional(),
	price: z.string().or(z.number()).transform(v => Number(v)).optional(),
	providerCost: z.string().or(z.number()).transform(v => Number(v)).optional(),
	useCustomProfit: z.string().or(z.boolean()).transform(v => typeof v === 'string' ? v === 'true' : Boolean(v)).optional(),
	pricingMethodChoice: z.enum(['markup', 'margin']).optional(),
	channelPricing: optionalJsonString.pipe(ChannelPricingZodSchema.optional()),
	paymentRestrictions: optionalJsonString.pipe(PaymentRestrictionsZodSchema.optional()),
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
	masterImageUrl: z.string().url('La URL de imagen maestra debe ser válida').optional().or(z.literal('')),
};

// 1. General Product Schema (Kioscos, Almacén, Bazar - Ultra Liviano)
export const KioskProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.literal(ProductType.KIOSK),
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


export const CombineWithItemZodSchema = z.union([
	z.string(),
	z.object({
		product: z.string(),
		variantSku: z.string().nullable().optional(),
		color: z.string().nullable().optional()
	})
]);

// 2. Clothing Product Schema (Indumentaria / Moda - Estricto)
export const ClothingProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.literal(ProductType.CLOTHING),
	shortDescription: z.string().optional().default(''),
	largeDescription: z.string().optional().default(''),
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
	combineWith: optionalJsonString.pipe(z.array(CombineWithItemZodSchema).optional()),
});

// 3. Tech Product Schema (Electrónica / Tecnología)
export const TechProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.literal(ProductType.TECH),
	shortDescription: z.string().optional().default(''),
	largeDescription: z.string().optional().default(''),
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
	shortDescription: z.string().optional().default(''),
	largeDescription: z.string().optional().default(''),
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

// 5. Universal Product Schema (Formulario Único Modular)
export const UniversalProductCreateSchema = z.object({
	...BaseProductFields,
	productType: z.string().optional().default(ProductType.KIOSK),
	shortDescription: z.string().optional(),
	largeDescription: z.string().optional(),
	barcode: z.string().optional(),
	isSoldByWeight: z.string().or(z.boolean()).transform(v => typeof v === 'string' ? v === 'true' : Boolean(v)).optional(),
	unit: z.string().optional(),
	weight: z.string().optional(),
	features: optionalJsonString.pipe(z.array(z.string()).optional()),
	specifications: optionalJsonString.pipe(z.array(SpecSchema).optional()),
	variants: optionalJsonString.pipe(z.array(UniversalVariantZodSchema).optional()),
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
	combineWith: optionalJsonString.pipe(z.array(CombineWithItemZodSchema).optional()),
	storage: optionalJsonString.pipe(z.array(z.string())).optional(),
	ram: z.string().optional(),
	processor: z.string().optional(),
	screenSize: z.string().optional(),
	os: z.string().optional(),
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

export const CreateProductBodySchema = z.union([
	UniversalProductCreateSchema,
	z.discriminatedUnion('productType', [
		KioskProductCreateSchema,
		ClothingProductCreateSchema,
		TechProductCreateSchema,
		BeautyProductCreateSchema
	])
]).superRefine((data: any, ctx) => {
	const cost = data.providerCost ?? data.price;
	if (cost === undefined || cost <= 0 || isNaN(cost)) {
		ctx.addIssue({
			code: 'custom',
			path: ['providerCost'],
			message: 'El costo del proveedor (providerCost) es requerido y debe ser mayor a 0'
		});
	}

	const hasName = Boolean((data.name && data.name.trim()) || (data.brand && data.brand.trim()));
	if (!hasName) {
		ctx.addIssue({
			code: 'custom',
			path: ['name'],
			message: 'El nombre o marca del producto es obligatorio'
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
		name: z.string().max(250).optional(),
		productType: z.enum(ProductType).optional(),
		provider: z.string().optional(),
		linkProductProvider: z.string().optional(),
		brand: z.string().max(200).optional(),
		model: z.string().max(200).optional(),
		subtitle: z.string().max(200).optional(),
		category: z.string().optional(),
		netStock: z.string().or(z.number()).transform(v => Number(v)).optional(),
		lowStockThreshold: z.string().or(z.number()).transform(v => Number(v)).optional(),
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
			z.array(z.union([UniversalVariantZodSchema, ClothingVariantZodSchema, TechVariantZodSchema, GeneralVariantZodSchema]))
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
		combineWith: optionalJsonString.pipe(z.array(CombineWithItemZodSchema).optional()).optional(),

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
		channelPricing: optionalJsonString.pipe(ChannelPricingZodSchema.optional()),
	paymentRestrictions: optionalJsonString.pipe(PaymentRestrictionsZodSchema.optional()),
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
		channelPricing: ChannelPricingZodSchema.optional(),
		customProfitMargin: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMargin1Pay: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional(),
		customProfitMarginInstallments: z.string().or(z.number()).transform(v => v === '' ? undefined : Number(v)).optional()
	})
});
