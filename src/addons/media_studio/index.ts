import { z } from 'zod';
import { AddonModule } from '../addon.types';
import { VexxPlanTier } from '@/interfaces/plan.interface';
import { AppError } from '@/errors/app.error';

export const MEDIA_STUDIO_ASPECT_RATIOS = ['original', '1:1', '4:5', '9:16', '16:9'] as const;
export type MediaStudioAspectRatio = (typeof MEDIA_STUDIO_ASPECT_RATIOS)[number];

export const mediaStudioSettingsSchema = z.object({
	defaultQuality: z.number().int().min(40).max(100).default(100),
	maxImagesPerProduct: z.number().int().min(1).max(100).optional(),
	enableCropper: z.boolean().default(true),
	enableVariantTagging: z.boolean().default(true),
	allowedAspectRatios: z
		.array(z.enum(MEDIA_STUDIO_ASPECT_RATIOS))
		.min(1)
		.default(['original', '1:1', '9:16', '16:9'])
});

export const MEDIA_STUDIO_DEFAULT_LIMITS: Record<VexxPlanTier, number> = {
	[VexxPlanTier.LOCAL]: 10,
	[VexxPlanTier.POINT]: 25,
	[VexxPlanTier.PRO]: 50
};

export const mediaStudioAddon: AddonModule = {
	manifest: {
		id: 'media_studio',
		aliases: ['product_gallery'],
		name: 'Media Studio — Recorte & Optimización WebP',
		shortDescription:
			'Editor multi-aspecto (1:1, 4:5, 9:16, 16:9), conversión automática a WebP, IDs agnósticos y vinculación multi-foto a variantes.',
		category: 'producto',
		icon: 'photo_library',
		implementationStatus: 'ready',
		includedInPlans: [VexxPlanTier.LOCAL, VexxPlanTier.POINT, VexxPlanTier.PRO],
		isPurchasable: true,
		monthlyPriceARS: 4500,
		surfaces: ['admin_form', 'storefront_section'],
		grantsCapabilities: [],
		requiresSetup: false,
		configurableLabels: [
			{
				key: 'galleryTitle',
				label: 'Título de la galería multimedia',
				description: 'Encabezado del módulo Media Studio en el alta/edición de producto.',
				defaultValue: 'Galería Multimedia & Recortes',
				surface: 'admin_form'
			},
			{
				key: 'gallerySubtitle',
				label: 'Subtítulo / ayuda de galería',
				description: 'Indicaciones de relación de aspecto y etiquetado por variante.',
				defaultValue: 'Optimizá a WebP, recortá por aspecto y vinculá fotos a tus variantes.',
				surface: 'admin_form'
			}
		],
		configurableSettings: [
			{
				key: 'defaultQuality',
				label: 'Calidad WebP por defecto (40-100)',
				description: 'Nivel de compresión WebP aplicado al subir imágenes en este comercio (100 = near-lossless).',
				type: 'number',
				defaultValue: 100
			},
			{
				key: 'maxImagesPerProduct',
				label: 'Máximo de fotos por producto',
				description: 'Sobrescribe el límite estándar del plan para este cliente.',
				type: 'number',
				defaultValue: 10
			},
			{
				key: 'enableCropper',
				label: 'Habilitar recortador multi-aspecto',
				description: 'Permite recortar 1:1, 4:5, 9:16 y 16:9 desde el formulario.',
				type: 'boolean',
				defaultValue: true
			},
			{
				key: 'enableVariantTagging',
				label: 'Habilitar vinculación de fotos a variantes',
				description: 'Permite etiquetar imágenes con SKUs de variantes (modo Tusty).',
				type: 'boolean',
				defaultValue: true
			}
		],
		targets: {
			domains: ['product_form', 'media'],
			productFormSlots: [{ slot: 'media_gallery', mode: 'replace', componentKey: 'media_studio_gallery' }],
			storefrontBlocks: ['multi_aspect_media', 'variant_filtered_gallery'],
			interactions: [
				{
					target: 'variants',
					behavior:
						'Cuando Variant Studio está activo, cada imagen habilita variantSkus[] para filtrar la galería por variante en tienda.'
				},
				{
					target: 'storefront_sections',
					behavior: 'Expone crops[] (1:1, 4:5, 9:16, 16:9) para que cada plantilla o banner consuma el recorte exacto.'
				}
			]
		},
		settingsSchema: mediaStudioSettingsSchema
	},
	hooks: {
		beforeProductValidate: (payload, settings) => {
			if (!Array.isArray(payload.images)) return;
			const maxImages =
				typeof settings?.maxImagesPerProduct === 'number' && settings.maxImagesPerProduct > 0
					? settings.maxImagesPerProduct
					: 20;

			if (payload.images.length > maxImages) {
				throw new AppError(
					'Media Studio max images exceeded',
					`Se excedió el límite de ${maxImages} imágenes por producto configurado en Media Studio.`,
					400
				);
			}
		}
	}
};
