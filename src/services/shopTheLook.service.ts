import mongoose from 'mongoose';
import slugify from 'slugify';
import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IShopTheLookDocument, IShopTheLook } from '@/interfaces/shopTheLook.interface';
import { ImageService } from '@/services/images.service';

export class ShopTheLookService {
	static async generateUniqueSlug(models: TenantModels, text: string, excludeId?: string): Promise<string> {
		const baseSlug = slugify(text || 'look', { lower: true, strict: true, trim: true }) || 'look';
		let slug = baseSlug;
		let counter = 1;

		while (true) {
			const query: any = { slug };
			if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
				query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
			}
			const exists = await models.ShopTheLook.findOne(query).select('_id').lean();
			if (!exists) break;
			counter++;
			slug = `${baseSlug}-${counter}`;
		}

		return slug;
	}

	static async getActiveLooks(models: TenantModels, tenantSlug?: string): Promise<IShopTheLookDocument[]> {
		try {
			const cacheKey = 'shopthelook:active';
			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				const cached = CacheService.get<IShopTheLookDocument[]>(tenantSlug, cacheKey);
				if (cached) return cached;
			}

			const looks = await models.ShopTheLook.find()
				.sort({ createdAt: -1 })
				.populate({
					path: 'looks.hotspots.product',
					match: { status: 'published' }
				})
				.lean() as any[];

			for (const look of looks) {
				if (!look.slug && look.title) {
					const generatedSlug = await this.generateUniqueSlug(models, look.title, String(look._id));
					look.slug = generatedSlug;
					models.ShopTheLook.findByIdAndUpdate(look._id, { $set: { slug: generatedSlug } }).catch(() => {});
				}
				if (look.looks) {
					look.looks.forEach((l: any) => {
						if (l.hotspots) {
							l.hotspots = l.hotspots.filter((h: any) => h.product !== null);
						}
					});
				}
			}

			const result = looks as unknown as IShopTheLookDocument[];

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.set(tenantSlug, cacheKey, result, 10 * 60 * 1000);
			}

			return result;
		} catch (error) {
			throw new AppError('Error fetching Shop The Look items', 'Error al obtener las campañas', 500);
		}
	}

	static async getLookById(models: TenantModels, identifier: string): Promise<IShopTheLookDocument> {
		try {
			const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
			let look: any = null;

			if (isObjectId) {
				look = await models.ShopTheLook.findById(identifier)
					.populate({
						path: 'looks.hotspots.product',
						match: { status: 'published' }
					})
					.lean();
			}

			if (!look) {
				look = await models.ShopTheLook.findOne({ slug: identifier.toLowerCase().trim() })
					.populate({
						path: 'looks.hotspots.product',
						match: { status: 'published' }
					})
					.lean();
			}

			if (!look) {
				throw new AppError('Look not found', 'Campaña no encontrada', 404);
			}

			if (!look.slug && look.title) {
				const generatedSlug = await this.generateUniqueSlug(models, look.title, String(look._id));
				look.slug = generatedSlug;
				models.ShopTheLook.findByIdAndUpdate(look._id, { $set: { slug: generatedSlug } }).catch(() => {});
			}

			if (look.looks) {
				look.looks.forEach((l: any) => {
					if (l.hotspots) {
						l.hotspots = l.hotspots.filter((h: any) => h.product !== null);
					}
				});
			}

			return look as unknown as IShopTheLookDocument;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error fetching Shop The Look item', 'Error al obtener la campaña', 500);
		}
	}

	static async createLook(models: TenantModels, data: IShopTheLook, tenantSlug?: string): Promise<IShopTheLookDocument> {
		try {
			if (data.slug) {
				data.slug = await this.generateUniqueSlug(models, data.slug);
			} else if (data.title) {
				data.slug = await this.generateUniqueSlug(models, data.title);
			}

			const newLook = await models.ShopTheLook.create(data);

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
				CacheService.invalidatePrefix(tenantSlug, 'home');
			}

			return newLook;
		} catch (error) {
			throw new AppError('Error creating Shop The Look item', 'Error al crear la campaña', 400);
		}
	}

	static async updateLook(models: TenantModels, lookId: string, data: Partial<IShopTheLook>, tenantSlug?: string): Promise<IShopTheLookDocument> {
		try {
			const isObjectId = mongoose.Types.ObjectId.isValid(lookId);
			const currentLook = (isObjectId
				? await models.ShopTheLook.findById(lookId).lean()
				: await models.ShopTheLook.findOne({ slug: lookId }).lean()) as unknown as IShopTheLookDocument;

			if (!currentLook) {
				throw new AppError('Look not found', 'Campaña no encontrada', 404);
			}

			const realId = currentLook._id ? String(currentLook._id) : lookId;

			if (data.slug) {
				data.slug = await this.generateUniqueSlug(models, data.slug, realId);
			} else if (data.title && (!currentLook.slug || data.title !== currentLook.title)) {
				data.slug = await this.generateUniqueSlug(models, data.title, realId);
			}

			if (data.looks) {
				const oldImages = currentLook.looks.map((l: any) => l.mainImage?.public_id).filter(Boolean);
				const newImages = data.looks.map((l: any) => l.mainImage?.public_id).filter(Boolean);

				const imagesToDelete = oldImages.filter(id => !newImages.includes(id));

				for (const publicId of imagesToDelete) {
					await ImageService.DeleteImage(publicId).catch(e => console.error('Failed to delete old image', e));
				}
			}

			const updatedLook = await models.ShopTheLook.findByIdAndUpdate(
				realId,
				{ $set: data },
				{ new: true, runValidators: true }
			).populate('looks.hotspots.product');

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
				CacheService.invalidatePrefix(tenantSlug, 'home');
			}

			return updatedLook as IShopTheLookDocument;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Error updating Shop The Look item', 'Error al actualizar la campaña', 400);
		}
	}

	static async deleteLook(models: TenantModels, lookId: string, tenantSlug?: string): Promise<void> {
		try {
			const isObjectId = mongoose.Types.ObjectId.isValid(lookId);
			const currentLook = (isObjectId
				? await models.ShopTheLook.findById(lookId).lean()
				: await models.ShopTheLook.findOne({ slug: lookId }).lean()) as unknown as IShopTheLookDocument;

			if (!currentLook) {
				throw new AppError('Look not found', 'Campaña no encontrada', 404);
			}

			const realId = currentLook._id ? String(currentLook._id) : lookId;

			const imagesToDelete = currentLook.looks.map((l: any) => l.mainImage?.public_id).filter(Boolean);
			for (const publicId of imagesToDelete) {
				await ImageService.DeleteImage(publicId).catch(e => console.error('Failed to delete image', e));
			}

			await models.ShopTheLook.findByIdAndDelete(realId);

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
				CacheService.invalidatePrefix(tenantSlug, 'home');
			}
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error deleting Shop The Look item', 'Error al eliminar la campaña', 400);
		}
	}
}
