import { z } from 'zod';

export const CreateBannerSchema = z.object({
	body: z.object({
		brandName: z.string().min(1, 'Brand Name is required'),
		description: z.string().min(1, 'Description is required'),
		image: z.string().optional(),
		title: z.string().min(1, 'Title is required'),
		subtitle: z.string().min(1, 'Subtitle is required'),
		
		textClass: z.string().optional(),
		buttonClass: z.string().optional(),
		icon: z.string().optional(),
		
		isActive: z.boolean().optional().or(z.string().transform((value) => Boolean(value))),
		order: z.number().int().optional().or(z.string().transform((value) => Number(value)))
	})
});

export const UpdateBannerSchema = z.object({
	body: z.object({
		brandName: z.string().optional(),
		description: z.string().optional(),
		image: z.string().optional(),
		title: z.string().optional(),
		subtitle: z.string().optional(),
		
		textClass: z.string().optional(),
		buttonClass: z.string().optional(),
		icon: z.string().optional(),
		
		isActive: z.boolean().optional().or(z.string().transform((value) => Boolean(value))),
		order: z.number().int().optional().or(z.string().transform((value) => Number(value)))
	})
});
