import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { protect, adminOnly } from '@/middleware/auth';
import { ImageService } from '@/services/images.service';
import { MEDIA_STUDIO_ASPECT_RATIOS } from './index';
import { AppError } from '@/errors/app.error';

const router: Router = Router();
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 20 * 1024 * 1024 } // Acepta originales pesados (ej. 20MB Gemini) para comprimirlos a WebP
});

const CropSpecSchema = z.object({
	aspectRatio: z.enum(MEDIA_STUDIO_ASPECT_RATIOS),
	xPct: z.number().min(0).max(1).default(0),
	yPct: z.number().min(0).max(1).default(0),
	wPct: z.number().min(0.05).max(1).default(1),
	hPct: z.number().min(0.05).max(1).default(1),
	quality: z.number().int().min(40).max(100).optional()
});

const MediaStudioBodySchema = z.object({
	quality: z.coerce.number().int().min(40).max(100).default(82),
	folder: z.string().trim().min(1).default('products'),
	idPrefix: z.string().trim().min(1).default('media'),
	crops: z.union([
		z.array(CropSpecSchema).min(1),
		z.string().transform((raw) => z.array(CropSpecSchema).min(1).parse(JSON.parse(raw)))
	])
});

/**
 * POST /api/addons/media-studio/upload
 * Recibe 1 archivo + cropSpecs normalizados (0..1) y genera recortes WebP optimizados con ID Vexx propio.
 */
router.post(
	'/upload',
	protect,
	adminOnly,
	upload.single('image'),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.file) {
				throw new AppError('Image file required', 'Debés adjuntar una imagen en el campo "image".', 400);
			}

			const parsed = MediaStudioBodySchema.parse(req.body);
			const tenantId = (req as any).tenant?._id?.toString() || 'shared';
			const folder = `tenants/${tenantId}/${parsed.folder}`;

			const result = await ImageService.UploadMediaStudioImage(
				req.file,
				parsed.crops,
				parsed.idPrefix,
				folder,
				parsed.quality
			);

			res.status(200).json({
				success: true,
				data: result
			});
		} catch (error) {
			next(error);
		}
	}
);

export default router;
