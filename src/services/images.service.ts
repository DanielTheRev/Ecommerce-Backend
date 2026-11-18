import { AppError } from '@/errors/app.error';
import { v2 as cloudinary } from 'cloudinary';
import DataURIParser from 'datauri/parser';
import path from 'path';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import type { MediaStudioAspectRatio } from '@/addons/media_studio';

cloudinary.config({
	cloud_name: process.env.CL_NAME,
	api_key: process.env.CL_API_KEY,
	api_secret: process.env.CL_API_SECRET
});

export interface MediaStudioCropSpec {
	aspectRatio: MediaStudioAspectRatio;
	/** Coordenadas normalizadas 0..1 sobre la imagen original */
	xPct: number;
	yPct: number;
	wPct: number;
	hPct: number;
	quality?: number;
}

export interface ProcessedCropBuffer {
	aspectRatio: MediaStudioAspectRatio;
	buffer: Buffer;
	width: number;
	height: number;
	bytes: number;
	format: 'webp';
}

const ASPECT_TARGET_MAX_DIM: Record<MediaStudioAspectRatio, { maxW: number; maxH: number }> = {
	'original': { maxW: 1600, maxH: 1920 },
	'1:1': { maxW: 1080, maxH: 1080 },
	'4:5': { maxW: 1080, maxH: 1350 },
	'9:16': { maxW: 1080, maxH: 1920 },
	'16:9': { maxW: 1920, maxH: 1080 }
};

export class ImageService {
	private constructor() {}

	/**
	 * Limpia el ID para que sea compatible con las URLs de Cloudinary
	 * Borra caracteres especiales, acentos y convierte espacios en guiones
	 */
	private static sanitizeId(id: string): string {
		return id
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-zA-Z0-9\s-_]/g, '')
			.trim()
			.replace(/\s+/g, '-');
	}

	private static bufferToDataUri(buffer: Buffer, ext = '.webp'): string {
		const parser = new DataURIParser();
		const file64 = parser.format(ext, buffer);
		if (!file64 || !file64.content) {
			throw new AppError('Invalid file content', 'Contenido de imagen inválido', 400);
		}
		return file64.content;
	}

	/**
	 * Optimización base obligatoria para todos los planes:
	 * auto-orienta EXIF, redimensiona a tope sano y convierte a WebP liviano.
	 */
	static async optimizeBufferToWebP(
		buffer: Buffer,
		options?: {
			quality?: number;
			maxWidth?: number;
			maxHeight?: number;
			crop?: Pick<MediaStudioCropSpec, 'xPct' | 'yPct' | 'wPct' | 'hPct'>;
		}
	): Promise<{ buffer: Buffer; width: number; height: number; bytes: number; format: 'webp' }> {
		const quality = Math.min(100, Math.max(40, options?.quality ?? 82));
		const maxWidth = options?.maxWidth ?? 1600;
		const maxHeight = options?.maxHeight ?? 1920;

		let pipeline = sharp(buffer).rotate();
		const metadata = await pipeline.metadata();
		const imgW = metadata.width || 0;
		const imgH = metadata.height || 0;

		if (options?.crop && imgW > 0 && imgH > 0) {
			const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
			const xPct = clamp01(options.crop.xPct);
			const yPct = clamp01(options.crop.yPct);
			const wPct = Math.max(0.05, Math.min(1 - xPct, clamp01(options.crop.wPct)));
			const hPct = Math.max(0.05, Math.min(1 - yPct, clamp01(options.crop.hPct)));

			const isFullFrame = xPct === 0 && yPct === 0 && wPct >= 0.999 && hPct >= 0.999;
			if (!isFullFrame) {
				const left = Math.max(0, Math.floor(xPct * imgW));
				const top = Math.max(0, Math.floor(yPct * imgH));
				const width = Math.max(1, Math.min(imgW - left, Math.round(wPct * imgW)));
				const height = Math.max(1, Math.min(imgH - top, Math.round(hPct * imgH)));

				pipeline = pipeline.extract({ left, top, width, height });
			}
		}

		const webpOptions =
			quality === 100
				? { quality: 100, effort: 6, nearLossless: true }
				: { quality, effort: 6 };

		const { data, info } = await pipeline
			.resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
			.webp(webpOptions)
			.toBuffer({ resolveWithObject: true });

		return {
			buffer: data,
			width: info.width,
			height: info.height,
			bytes: data.length,
			format: 'webp'
		};
	}

	/**
	 * Procesa múltiples recortes (1:1, 4:5, 9:16, 16:9) desde un único buffer original.
	 */
	static async processMediaStudioCrops(
		buffer: Buffer,
		cropSpecs: MediaStudioCropSpec[],
		defaultQuality = 82
	): Promise<{ originalBytes: number; crops: ProcessedCropBuffer[] }> {
		if (!Array.isArray(cropSpecs) || cropSpecs.length === 0) {
			throw new AppError(
				'Media Studio cropSpecs required',
				'Debés enviar al menos un recorte (aspectRatio) para procesar la imagen.',
				400
			);
		}

		const crops = await Promise.all(
			cropSpecs.map(async (spec) => {
				const targetDim = ASPECT_TARGET_MAX_DIM[spec.aspectRatio];
				if (!targetDim) {
					throw new AppError(
						'Invalid aspect ratio',
						`Relación de aspecto inválida: ${spec.aspectRatio}`,
						400
					);
				}

				const optimized = await this.optimizeBufferToWebP(buffer, {
					quality: spec.quality ?? defaultQuality,
					maxWidth: targetDim.maxW,
					maxHeight: targetDim.maxH,
					crop: spec
				});

				return {
					aspectRatio: spec.aspectRatio,
					...optimized
				};
			})
		);

		return {
			originalBytes: buffer.length,
			crops
		};
	}

	/**
	 * Normaliza cualquier imagen Open Graph (seoImage) a 1200x630 JPEG (1.91:1)
	 * re-codificando desde cero con Sharp (elimina metadata/EXIF y garantiza compatibilidad WhatsApp/IG).
	 */
	static async UploadOgImage1200x630(
		file: Express.Multer.File,
		idPrefix: string,
		folder: string
	) {
		if (!file?.buffer || file.buffer.length === 0) {
			throw new AppError('Invalid OG image', 'La imagen OG está vacía o no se pudo leer.', 400);
		}
		const maxBytes = 5 * 1024 * 1024;
		if (file.buffer.length > maxBytes) {
			throw new AppError(
				'OG image too large',
				'La imagen OG supera el máximo permitido de 5 MB.',
				400
			);
		}
		const jpegBuffer = await sharp(file.buffer)
			.rotate()
			.resize(1200, 630, { fit: 'cover', position: 'centre' })
			.jpeg({ quality: 88, mozjpeg: true })
			.toBuffer();

		return this.UploadBuffer(jpegBuffer, idPrefix, folder, '.jpg');
	}

	/**
	 * Sube una imagen procesada por Media Studio con N recortes WebP e ID Vexx agnóstico de Cloudinary.
	 */
	static async UploadMediaStudioImage(
		file: Express.Multer.File,
		cropSpecs: MediaStudioCropSpec[],
		idPrefix: string,
		folder: string,
		defaultQuality = 82
	) {
		const vexxImageId = `img_${randomUUID()}`;
		const { originalBytes, crops } = await this.processMediaStudioCrops(file.buffer, cropSpecs, defaultQuality);

		const uploadedCrops = await Promise.all(
			crops.map(async (crop) => {
				const ratioTag = crop.aspectRatio.replace(':', 'x');
				const uploaded = await this.UploadBuffer(
					crop.buffer,
					`${idPrefix}-${ratioTag}`,
					folder,
					'.webp'
				);
				return {
					aspectRatio: crop.aspectRatio,
					url: uploaded.secure_url,
					public_id: uploaded.public_id,
					storageKey: uploaded.public_id,
					width: crop.width,
					height: crop.height,
					bytes: crop.bytes,
					format: 'webp' as const
				};
			})
		);

		const primary = uploadedCrops[0];
		const totalOptimizedBytes = uploadedCrops.reduce((acc, c) => acc + c.bytes, 0);
		const avgBytes = Math.round(totalOptimizedBytes / uploadedCrops.length);
		const savingsPercent = originalBytes > 0 ? Math.max(0, Math.round((1 - avgBytes / originalBytes) * 100)) : 0;

		return {
			id: vexxImageId,
			url: primary.url,
			public_id: primary.public_id,
			storageProvider: 'cloudinary',
			storageKey: primary.storageKey,
			width: primary.width,
			height: primary.height,
			bytes: primary.bytes,
			format: 'webp',
			aspectRatio: primary.aspectRatio,
			originalBytes,
			savingsPercent,
			crops: uploadedCrops
		};
	}

	private static async UploadBuffer(buffer: Buffer, id: string, folder: string, ext = '.webp') {
		const contentToUpload = this.bufferToDataUri(buffer, ext);
		try {
			const cleanId = this.sanitizeId(id);
			return await cloudinary.uploader.upload(contentToUpload, {
				public_id: `${cleanId}-${randomUUID()}`,
				overwrite: true,
				folder,
				resource_type: 'auto'
			});
		} catch (error) {
			console.error('Cloudinary Error:', error);
			throw new AppError(
				'Cloudinary upload failed',
				'Error al procesar la imagen en la nube',
				500
			);
		}
	}

	/**
	 * Upload an image to cloudinary from file or URL (optimizando automáticamente archivos raster a WebP)
	 */
	static async UploadImage(source: Express.Multer.File | string, id: string, folder: string) {
		if (typeof source === 'string') {
			try {
				const cleanId = this.sanitizeId(id);
				return await cloudinary.uploader.upload(source, {
					public_id: `${cleanId}-${randomUUID()}`,
					overwrite: true,
					folder,
					resource_type: 'auto'
				});
			} catch (error) {
				console.error('Cloudinary Error:', error);
				throw new AppError('Cloudinary upload failed', 'Error al procesar la imagen en la nube', 500);
			}
		}

		const extName = path.extname(source.originalname || '').toLowerCase();
		const skipOptimization = extName === '.svg' || extName === '.gif' || source.mimetype === 'image/svg+xml' || source.mimetype === 'image/gif';

		if (!skipOptimization) {
			const optimized = await this.optimizeBufferToWebP(source.buffer, { quality: 82 });
			return this.UploadBuffer(optimized.buffer, id, folder, '.webp');
		}

		return this.UploadBuffer(source.buffer, id, folder, extName || '.png');
	}

	static async UploadImages(
		files: { id: string; source: Express.Multer.File | string }[],
		folder: string
	) {
		try {
			const uploads = files.map((file) => this.UploadImage(file.source, file.id, folder));
			const uploaded = await Promise.all(uploads);

			return uploaded.map((image) => ({
				id: `img_${randomUUID()}`,
				public_id: image.public_id,
				storageProvider: 'cloudinary',
				storageKey: image.public_id,
				url: image.secure_url,
				width: image.width,
				height: image.height,
				bytes: image.bytes,
				format: image.format
			}));
		} catch (error) {
			console.log(error);
			throw new AppError(
				'Error uploading images in imageService.uploadImages',
				'Error al subir imágenes al servidor',
				500
			);
		}
	}

	static async DeleteImage(publicID: string) {
		if (!publicID || typeof publicID !== 'string' || !publicID.trim()) {
			return;
		}
		return cloudinary.uploader.destroy(publicID.trim());
	}
}
