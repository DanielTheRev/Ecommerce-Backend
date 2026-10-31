import multer from 'multer';
import { AppError } from '@/errors/app.error';

export const ALLOWED_IMAGE_MIMES = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/svg+xml',
	'image/avif',
	'image/heic',
	'image/heif'
];

export const ALLOWED_RECEIPT_MIMES = [
	...ALLOWED_IMAGE_MIMES,
	'application/pdf'
];

export const imageUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024 // 10 MB máximo por imagen
	},
	fileFilter: (_req, file, cb) => {
		if (ALLOWED_IMAGE_MIMES.includes((file.mimetype || '').toLowerCase())) {
			cb(null, true);
		} else {
			cb(new AppError('Invalid file type', 'Solo se permiten imágenes válidas (JPG, PNG, WebP, AVIF, SVG).', 400));
		}
	}
});

export const receiptUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024 // 5 MB máximo para comprobantes
	},
	fileFilter: (_req, file, cb) => {
		if (ALLOWED_RECEIPT_MIMES.includes((file.mimetype || '').toLowerCase())) {
			cb(null, true);
		} else {
			cb(new AppError('Invalid file type', 'Para comprobantes de pago solo se permiten imágenes o archivos PDF (máximo 5 MB).', 400));
		}
	}
});
