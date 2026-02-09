import { z } from 'zod';

export const CreateBannerSchema = z.object({
	body: z.object({
		brandName: z.string().min(1, 'Brand Name is required'),
		description: z.string().min(1, 'Description is required'),
		image: z.url('Image must be a valid URL'),
		title: z.string().min(1, 'Title is required'),
		subtitle: z.string().min(1, 'Subtitle is required'),
		
		textClass: z.string().optional(),
		buttonClass: z.string().optional(),
		icon: z.string().optional(),
		
		isActive: z.boolean().optional(),
		order: z.number().int().optional()
	})
});

export const UpdateBannerSchema = z.object({
	body: z.object({
		brandName: z.string().optional(),
		description: z.string().optional(),
		image: z.url().optional(),
		title: z.string().optional(),
		subtitle: z.string().optional(),
		
		textClass: z.string().optional(),
		buttonClass: z.string().optional(),
		icon: z.string().optional(),
		
		isActive: z.boolean().optional(),
		order: z.number().int().optional()
	})
});
