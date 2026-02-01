import { AppError } from '@/errors/app.error';
import { v2 as cloudinary } from 'cloudinary';
import DataURIParser from 'datauri/parser';
import path from 'path';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Cargar variables de entorno
dotenv.config();

cloudinary.config({
	cloud_name: process.env.CL_NAME,
	api_key: process.env.CL_API_KEY,
	api_secret: process.env.CL_API_SECRET
});

export class ImageService {
	private constructor() {

	}
	/**
	 * Upload an image to cloudinary from file or URL
	 * @param source - Express.Multer.File o string (URL)
	 */
	static async UploadImage(source: Express.Multer.File | string, id: string, folder: string) {
		let contentToUpload: string;
		if (typeof source === 'string') {
			contentToUpload = source;
		} else {
			// Si es un archivo Multer, usamos el Parser
			const parser = new DataURIParser();
			const extName = path.extname(source.originalname).toString();
			const file64 = parser.format(extName, source.buffer);

			if (!file64 || !file64.content) {
				throw new AppError('Invalid file content', 'Contenido de imagen inválido', 400);
			}
			contentToUpload = file64.content;
		}

		try {
			// 2. Subida con parámetros de optimización
			const img_uploaded = await cloudinary.uploader.upload(contentToUpload, {
				public_id: `${id}-${uuidv4()}`,
				overwrite: true,
				folder: folder,
				resource_type: 'auto', // Detecta si es jpg, png, webp, etc.
				transformation: [
					{ quality: 'auto', fetch_format: 'auto' } // Optimización desde el origen
				]
			});

			return img_uploaded;
		} catch (error) {
			console.error('Cloudinary Error:', error);
			throw new AppError(
				'Cloudinary upload failed',
				'Error al procesar la imagen en la nube',
				500
			);
		}
	}

	static async UploadImages(
		files: { id: string; source: Express.Multer.File | string }[],
		folder: string
	) {
		try {
			const uploads = files.map((file) => this.UploadImage(file.source, file.id, folder));
			const uploaded = await Promise.all(uploads);
			const formattedImages = uploaded.map((image) => ({
				public_id: image.public_id,
				url: image.secure_url,
				width: image.width,
				height: image.height
			}));
			return formattedImages;
		} catch (error) {
			throw new AppError(
				'Error uploading images in imageService.uploadImages',
				'Error al subir imágenes al servidor',
				500
			);
		}
	}

	static async DeleteImage(publicID: string) {
		return cloudinary.uploader.destroy(publicID);
	}
}
