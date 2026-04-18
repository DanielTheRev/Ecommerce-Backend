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
	private constructor() { }

	/**
	 * Limpia el ID para que sea compatible con las URLs de Cloudinary
	 * Borra caracteres especiales, acentos y convierte espacios en guiones
	 */
	private static sanitizeId(id: string): string {
		return id
			.normalize('NFD') // Descompone caracteres con acentos (á -> a + ´)
			.replace(/[\u0300-\u036f]/g, '') // Elimina los acentos
			.replace(/[^a-zA-Z0-9\s-_]/g, '') // Elimina todo lo que no sea letra, nro, espacio, - o _ (chau &)
			.trim()
			.replace(/\s+/g, '-'); // Reemplaza espacios (uno o más) por un solo guion
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
			const parser = new DataURIParser();
			const extName = path.extname(source.originalname).toString();
			const file64 = parser.format(extName, source.buffer);

			if (!file64 || !file64.content) {
				throw new AppError('Invalid file content', 'Contenido de imagen inválido', 400);
			}
			contentToUpload = file64.content;
		}

		try {
			// Sanitizamos el ID antes de enviarlo
			const cleanId = this.sanitizeId(id);

			const img_uploaded = await cloudinary.uploader.upload(contentToUpload, {
				public_id: `${cleanId}-${uuidv4()}`, // ID limpio + identificador único
				overwrite: true,
				folder: folder,
				resource_type: 'auto',
				transformation: [
					{ quality: 'auto', fetch_format: 'auto' }
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
			// Usamos el mismo proceso de sanitización para subidas masivas
			const uploads = files.map((file) => this.UploadImage(file.source, file.id, folder));
			const uploaded = await Promise.all(uploads);

			return uploaded.map((image) => ({
				public_id: image.public_id,
				url: image.secure_url,
				width: image.width,
				height: image.height
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
		return cloudinary.uploader.destroy(publicID);
	}
}