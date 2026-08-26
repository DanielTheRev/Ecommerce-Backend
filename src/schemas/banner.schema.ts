import { z } from 'zod';

const linkTypeEnum = z.enum(['none', 'category', 'collection', 'brand', 'product', 'custom']);
const productSourceEnum = z.enum(['category', 'collection', 'brand', 'manual', 'recent']);

const jsonArray = z.string().transform((str) => {
	try {
		const parsed = JSON.parse(str);
		return Array.isArray(parsed) ? parsed : [parsed];
	} catch (e) {
		return str ? [str] : [];
	}
});

export const CreateBannerSchema = z.object({
	body: z.object({
		name: z.string().optional(),
		image: z.string().optional(),
		imageMobile: z.string().optional(),

		linkType: linkTypeEnum.optional().default('none'),
		linkValue: z.string().optional().default(''),

		showProducts: z.coerce.boolean().optional().default(false),
		productSource: productSourceEnum.optional().default('recent'),
		productSourceValue: z.string().optional().default(''),
		manualProductIds: z.array(z.string()).or(jsonArray).optional(),
		productsCount: z.coerce.number().int().min(1).max(20).optional().default(4),

		// Legacy / optional fields
		brandName: z.string().optional(),
		description: z.string().optional(),
		title: z.string().optional(),
		subtitle: z.string().optional(),
		textClass: z.string().optional(),
		buttonClass: z.string().optional(),
		icon: z.string().optional(),

		isActive: z.coerce.boolean().optional().default(true),
		order: z.coerce.number().int().optional().default(0)
	})
});

export const UpdateBannerSchema = z.object({
	body: z.object({
		name: z.string().optional(),
		image: z.string().optional(),
		imageMobile: z.string().optional(),

		linkType: linkTypeEnum.optional(),
		linkValue: z.string().optional(),

		showProducts: z.coerce.boolean().optional(),
		productSource: productSourceEnum.optional(),
		productSourceValue: z.string().optional(),
		manualProductIds: z.array(z.string()).or(jsonArray).optional(),
		productsCount: z.coerce.number().int().min(1).max(20).optional(),

		// Legacy / optional fields
		brandName: z.string().optional(),
		description: z.string().optional(),
		title: z.string().optional(),
		subtitle: z.string().optional(),
		textClass: z.string().optional(),
		buttonClass: z.string().optional(),
		icon: z.string().optional(),

		isActive: z.coerce.boolean().optional(),
		order: z.coerce.number().int().optional()
	})
});
