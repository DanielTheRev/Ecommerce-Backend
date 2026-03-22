import { NextFunction, Response } from 'express';
import { ShopTheLookService } from '@/services/shopTheLook.service';
import { AuthRequest } from '@/middleware/auth';
import { AppError } from '@/errors/app.error';
import { ImageService } from '@/services/images.service';
import { IShopTheLook } from '@/interfaces/shopTheLook.interface';

export class ShopTheLookController {
	static async getActiveLooks(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const looks = await ShopTheLookService.getActiveLooks(req.models!);
			return res.status(200).json(looks);
		} catch (error) {
			return next(error);
		}
	}

	static async getShopTheLook(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const look = await ShopTheLookService.getLookById(req.models!, id);
			return res.status(200).json(look);
		} catch (error) {
			return next(error);
		}
	}

	static async createLook(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { title, subtitle, isActive, looks } = req.body;
			const tenantSlug = req.tenant?.slug as string;

			if (!title) throw new AppError('Title is required', 'El título es requerido', 400);

			let parsedLooks: any[] = [];
			if (looks) {
				try {
					parsedLooks = typeof looks === 'string' ? JSON.parse(looks) : looks;
				} catch (e) {
					throw new AppError('Invalid looks format', 'Formato de looks inválido', 400);
				}
			}

			const files = req.files as Express.Multer.File[] || [];

			for (let i = 0; i < parsedLooks.length; i++) {
				const lookData = parsedLooks[i];
				const file = files.find(f => f.fieldname === `image_${i}`);
				if (file) {
					const imageId = `shop-the-look-${Date.now()}-${i}`;
					const uploadedImage = await ImageService.UploadImage(file, imageId, `${tenantSlug}/shop-the-look`);
					lookData.mainImage = {
						url: uploadedImage.secure_url,
						public_id: uploadedImage.public_id
					};
				} else if (!lookData.mainImage || !lookData.mainImage.url) {
					throw new AppError(`Missing image for look index ${i}`, `Falta imagen para el look en la posición ${i}`, 400);
				}
			}

			const data: IShopTheLook = {
				title,
				subtitle: subtitle || '',
				isActive: isActive === 'true' || isActive === true,
				looks: parsedLooks
			};

			const newLook = await ShopTheLookService.createLook(req.models!, data);
			return res.status(201).json(newLook);
		} catch (error) {
			return next(error);
		}
	}

	static async updateLook(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const { title, subtitle, isActive, looks } = req.body;
			const tenantSlug = req.tenant?.slug as string;

			let parsedLooks: any[] = [];
			if (looks) {
				try {
					parsedLooks = typeof looks === 'string' ? JSON.parse(looks) : looks;
				} catch (e) {
					throw new AppError('Invalid looks format', 'Formato de looks inválido', 400);
				}
			}

			const updateData: Partial<IShopTheLook> = {};
			if (title !== undefined) updateData.title = title;
			if (subtitle !== undefined) updateData.subtitle = subtitle;
			if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

			if (looks) {
				const files = req.files as Express.Multer.File[] || [];

				for (let i = 0; i < parsedLooks.length; i++) {
					const lookData = parsedLooks[i];
					const file = files.find(f => f.fieldname === `image_${i}`);
					if (file) {
						const imageId = `shop-the-look-update-${Date.now()}-${i}`;
						const uploadedImage = await ImageService.UploadImage(file, imageId, `${tenantSlug}/shop-the-look`);
						lookData.mainImage = {
							url: uploadedImage.secure_url,
							public_id: uploadedImage.public_id
						};
					} else if (!lookData.mainImage || !lookData.mainImage.url) {
						throw new AppError(`Missing image for look index ${i}`, `Falta imagen para el look en la posición ${i}`, 400);
					}
				}
				updateData.looks = parsedLooks;
			}

			const updatedLook = await ShopTheLookService.updateLook(req.models!, id, updateData);

			return res.status(200).json(updatedLook);
		} catch (error) {
			return next(error);
		}
	}

	static async deleteLook(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;

			await ShopTheLookService.deleteLook(req.models!, id);

			return res.status(200).json({ message: 'Look eliminado correctamente' });
		} catch (error) {
			return next(error);
		}
	}
}
