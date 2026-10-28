import { NextFunction, Response } from 'express';
import { ShopTheLookService } from '@/services/shopTheLook.service';
import { AuthRequest } from '@/middleware/auth';
import { AppError } from '@/errors/app.error';
import { ImageService } from '@/services/images.service';
import { IShopTheLook, IShopTheLookImage, IShopTheLookProductItem } from '@/interfaces/shopTheLook.interface';

export class ShopTheLookController {
	static async getActiveLooks(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const looks = await ShopTheLookService.getActiveLooks(req.models!, req.tenant?.slug);
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

	static async trackEngagement(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const { action } = req.body; // 'like' | 'share'
			const validActions = ['like', 'share', 'view', 'cart'];
			if (!validActions.includes(action)) {
				throw new AppError('Invalid action', 'Acción inválida (debe ser like, share, view o cart)', 400);
			}

			const result = await ShopTheLookService.trackEngagement(req.models!, id, action, req.tenant?.slug);
			return res.status(200).json(result);
		} catch (error) {
			return next(error);
		}
	}

	static async createLook(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { name, title, description, subtitle, occasion, isActive, looks, products, gallery, slug, order, rankingScore } = req.body;
			const tenantSlug = req.tenant?.slug as string;
			const lookName = name || title;

			if (!lookName) throw new AppError('Name is required', 'El nombre del look es requerido', 400);

			const files = (req.files as Express.Multer.File[]) || [];
			let parsedGallery: IShopTheLookImage[] = [];
			let parsedProducts: IShopTheLookProductItem[] = [];

			if (gallery) {
				try {
					parsedGallery = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
				} catch (e) {
					parsedGallery = [];
				}
			}

			if (products) {
				try {
					parsedProducts = typeof products === 'string' ? JSON.parse(products) : products;
				} catch (e) {
					parsedProducts = [];
				}
			}

			// Subida de imágenes para la galería
			const galleryFiles = files.filter(f => f.fieldname.startsWith('gallery_') || f.fieldname === 'gallery' || f.fieldname.startsWith('image_'));
			for (let i = 0; i < galleryFiles.length; i++) {
				const file = galleryFiles[i];
				const imageId = `look-${Date.now()}-${i}`;
				const uploadedImage = await ImageService.UploadImage(file, imageId, `${tenantSlug}/shop-the-look`);
				parsedGallery.push({
					url: uploadedImage.secure_url,
					public_id: uploadedImage.public_id,
					width: uploadedImage.width,
					height: uploadedImage.height
				});
			}

			// Manejo de compatibilidad con campañas legacy si se envían looks anidados
			let parsedLooks: any[] = [];
			if (looks) {
				try {
					parsedLooks = typeof looks === 'string' ? JSON.parse(looks) : looks;
				} catch (e) {
					parsedLooks = [];
				}
			}

			// Parsear SEO
			let parsedSeo: any = undefined;
			if (req.body.seo) {
				try {
					parsedSeo = typeof req.body.seo === 'string' ? JSON.parse(req.body.seo) : req.body.seo;
				} catch (e) {
					parsedSeo = undefined;
				}
			}

			// Subida de imagen dedicada para SEO (OpenGraph) si existe
			const seoImageFile = files.find(f => f.fieldname === 'seoImage' || f.fieldname === 'seo_image');
			if (seoImageFile) {
				const seoImageId = `look-seo-${Date.now()}`;
				const uploadedSeoImage = await ImageService.UploadImage(seoImageFile, seoImageId, `${tenantSlug}/shop-the-look/seo`);
				if (!parsedSeo) parsedSeo = {};
				parsedSeo.metaImage = {
					url: uploadedSeoImage.secure_url,
					public_id: uploadedSeoImage.public_id
				};
			}

			const data: IShopTheLook = {
				name: lookName,
				title: lookName,
				description: description || subtitle || '',
				subtitle: subtitle || description || '',
				occasion: occasion || '',
				slug: slug ? String(slug).trim().toLowerCase() : undefined as any,
				isActive: isActive === 'true' || isActive === true,
				gallery: parsedGallery,
				products: parsedProducts,
				order: order !== undefined ? Number(order) : 0,
				looks: parsedLooks,
				...(parsedSeo ? { seo: parsedSeo } : {})
			};

			const newLook = await ShopTheLookService.createLook(req.models!, data, tenantSlug);
			return res.status(201).json(newLook);
		} catch (error) {
			return next(error);
		}
	}

	static async updateLook(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const { name, title, description, subtitle, occasion, isActive, looks, products, gallery, slug, order, likes, shares, rankingScore, seo, deletedSeoOgImage } = req.body;
			const tenantSlug = req.tenant?.slug as string;

			const updateData: Partial<IShopTheLook> = {};
			const lookName = name || title;
			if (lookName !== undefined) {
				updateData.name = lookName;
				updateData.title = lookName;
			}
			if (description !== undefined || subtitle !== undefined) {
				updateData.description = description || subtitle || '';
				updateData.subtitle = subtitle || description || '';
			}
			if (occasion !== undefined) updateData.occasion = occasion;
			if (slug !== undefined) updateData.slug = String(slug).trim().toLowerCase();
			if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;
			if (order !== undefined) updateData.order = Number(order);
			if (rankingScore !== undefined) updateData.rankingScore = Number(rankingScore);
			if (likes !== undefined) updateData.likes = Number(likes);
			if (shares !== undefined) updateData.shares = Number(shares);

			// Parsear SEO
			let parsedSeo: any = undefined;
			if (seo) {
				try {
					parsedSeo = typeof seo === 'string' ? JSON.parse(seo) : seo;
				} catch (e) {
					parsedSeo = undefined;
				}
			}

			// Manejo de imagen SEO previa eliminada
			if (deletedSeoOgImage && typeof deletedSeoOgImage === 'string' && deletedSeoOgImage.trim()) {
				await ImageService.DeleteImage(deletedSeoOgImage.trim()).catch(e => console.error('Failed to delete old SEO image', e));
				if (!parsedSeo) parsedSeo = {};
				parsedSeo.metaImage = { url: '', public_id: '' };
			}

			if (gallery) {
				try {
					updateData.gallery = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
				} catch (e) {
					// mantener si falla parse
				}
			}

			if (products) {
				try {
					updateData.products = typeof products === 'string' ? JSON.parse(products) : products;
				} catch (e) {
					// mantener si falla parse
				}
			}

			// Subir nuevas fotos añadidas
			const files = (req.files as Express.Multer.File[]) || [];
			const galleryFiles = files.filter(f => f.fieldname.startsWith('gallery_') || f.fieldname === 'gallery' || f.fieldname.startsWith('image_'));
			if (galleryFiles.length > 0) {
				if (!updateData.gallery) updateData.gallery = [];
				for (let i = 0; i < galleryFiles.length; i++) {
					const file = galleryFiles[i];
					const imageId = `look-update-${Date.now()}-${i}`;
					const uploadedImage = await ImageService.UploadImage(file, imageId, `${tenantSlug}/shop-the-look`);
					updateData.gallery.push({
						url: uploadedImage.secure_url,
						public_id: uploadedImage.public_id,
						width: uploadedImage.width,
						height: uploadedImage.height
					});
				}
			}

			// Subida de nueva imagen SEO si fue enviada
			const seoImageFile = files.find(f => f.fieldname === 'seoImage' || f.fieldname === 'seo_image');
			if (seoImageFile) {
				const seoImageId = `look-seo-update-${Date.now()}`;
				const uploadedSeoImage = await ImageService.UploadImage(seoImageFile, seoImageId, `${tenantSlug}/shop-the-look/seo`);
				if (!parsedSeo) parsedSeo = {};
				parsedSeo.metaImage = {
					url: uploadedSeoImage.secure_url,
					public_id: uploadedSeoImage.public_id
				};
			}

			if (parsedSeo !== undefined) {
				updateData.seo = parsedSeo;
			}

			if (looks) {
				try {
					updateData.looks = typeof looks === 'string' ? JSON.parse(looks) : looks;
				} catch (e) {
					// mantener si falla parse
				}
			}

			const updatedLook = await ShopTheLookService.updateLook(req.models!, id, updateData, tenantSlug);

			return res.status(200).json(updatedLook);
		} catch (error) {
			return next(error);
		}
	}

	static async updateRankingScore(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const { rankingScore, order } = req.body;
			const result = await ShopTheLookService.updateRankingScore(
				req.models!,
				id,
				{ rankingScore, order },
				req.tenant?.slug
			);
			return res.status(200).json({ success: true, data: result });
		} catch (error) {
			return next(error);
		}
	}

	static async resetAllRankingBase(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { resetBaseTo100 } = req.body || {};
			const result = await ShopTheLookService.resetAllToRankingBase(
				req.models!,
				Boolean(resetBaseTo100),
				req.tenant?.slug
			);
			return res.status(200).json({
				success: true,
				message: `Reinicio de ranking a base completado. ${result.updatedCount} outfits reiniciados.`,
				updatedCount: result.updatedCount
			});
		} catch (error) {
			return next(error);
		}
	}

	static async resetRankingScore(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const { resetBaseTo100 } = req.body || {};
			const result = await ShopTheLookService.resetLookRankingBase(
				req.models!,
				id,
				Boolean(resetBaseTo100),
				req.tenant?.slug
			);
			return res.status(200).json({
				success: true,
				message: 'Puntaje de ranking del outfit reiniciado a base exitosamente',
				data: result
			});
		} catch (error) {
			return next(error);
		}
	}

	static async deleteLook(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;

			await ShopTheLookService.deleteLook(req.models!, id, req.tenant?.slug);

			return res.status(200).json({ message: 'Look eliminado correctamente' });
		} catch (error) {
			return next(error);
		}
	}
}
