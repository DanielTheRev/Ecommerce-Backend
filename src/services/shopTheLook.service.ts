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

	/**
	 * Hidrata en tiempo real las imágenes de variantes de las prendas en el look
	 * consultando directamente la variante activa del producto poblado.
	 * Si la variante no tiene imagen asignada, se setea a null de forma estricta (sin fallbacks).
	 */
	static hydrateLiveVariantImages(look: any): void {
		if (!look) return;

		const processItems = (items: any[]) => {
			if (!Array.isArray(items)) return;
			for (const item of items) {
				const prod = item.product;
				if (!prod || typeof prod !== 'object') continue;

				// Buscar variante activa que coincida con el SKU o Color seleccionado en el pin
				const variant = prod.variants?.find((v: any) =>
					(item.selectedSku && v.sku === item.selectedSku) ||
					(item.selectedColor?.name && v.color?.name?.trim().toLowerCase() === item.selectedColor.name.trim().toLowerCase())
				);

				// Solo si la variante específica tiene foto viva, se la asignamos
				if (variant?.imageReference?.url) {
					item.variantImage = {
						url: variant.imageReference.url,
						public_id: variant.imageReference.public_id || ''
					};
				} else {
					// Si la variante no tiene foto: null directo, sin inventar imágenes ni fallbacks
					item.variantImage = null;
				}
			}
		};

		if (look.products) processItems(look.products);
		if (look.looks) {
			for (const subLook of look.looks) {
				if (subLook.hotspots) processItems(subLook.hotspots);
			}
		}
	}

	static async getActiveLooks(models: TenantModels, tenantSlug?: string): Promise<IShopTheLookDocument[]> {
		try {
			const cacheKey = 'shopthelook:active';
			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				const cached = CacheService.get<IShopTheLookDocument[]>(tenantSlug, cacheKey);
				if (cached) return cached;
			}

			const looks = await models.ShopTheLook.find({ isActive: true })
				.sort({ effectiveScore: -1, createdAt: -1 })
				.populate({
					path: 'products.product',
					match: { status: 'published' }
				})
				.populate({
					path: 'looks.hotspots.product',
					match: { status: 'published' }
				})
				.lean() as any[];

			for (const look of looks) {
				const titleOrName = look.name || look.title || 'Look';
				if (!look.name) look.name = titleOrName;
				if (!look.title) look.title = titleOrName;

				if (!look.slug) {
					const generatedSlug = await this.generateUniqueSlug(models, titleOrName, String(look._id));
					look.slug = generatedSlug;
					models.ShopTheLook.findByIdAndUpdate(look._id, { $set: { slug: generatedSlug } }).catch(() => {});
				}

				// Auto-inicialización transparente de puntaje ELO si no existía
				if (look.effectiveScore === undefined || look.effectiveScore === null) {
					const baseScore = look.rankingScore ?? 100;
					const likes = look.likes || 0;
					const shares = look.shares || 0;
					const calculatedEffective = baseScore + (likes * 3) + (shares * 5);
					look.rankingScore = baseScore;
					look.effectiveScore = calculatedEffective;
					models.ShopTheLook.findByIdAndUpdate(look._id, {
						$set: {
							rankingScore: baseScore,
							effectiveScore: calculatedEffective,
							'metrics.viewsCount': 0,
							'metrics.likesCount': likes,
							'metrics.sharesCount': shares,
							'metrics.cartAddsCount': 0,
							'metrics.salesCount': 0
						}
					}).catch(() => {});
				}

				// Limpiar referencias a productos no publicados/eliminados
				if (look.products) {
					look.products = look.products.filter((p: any) => p.product !== null && p.product !== undefined);
				}
				if (look.looks) {
					look.looks.forEach((l: any) => {
						if (l.hotspots) {
							l.hotspots = l.hotspots.filter((h: any) => h.product !== null && h.product !== undefined);
						}
					});
				}

				// Hidratación en tiempo real de imágenes de variantes
				this.hydrateLiveVariantImages(look);
			}

			const result = looks as unknown as IShopTheLookDocument[];

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.set(tenantSlug, cacheKey, result, 10 * 60 * 1000);
			}

			return result;
		} catch (error) {
			throw new AppError('Error fetching Shop The Look items', 'Error al obtener los looks', 500);
		}
	}

	static async getLookById(models: TenantModels, identifier: string): Promise<IShopTheLookDocument> {
		try {
			const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
			let look: any = null;

			if (isObjectId) {
				look = await models.ShopTheLook.findById(identifier)
					.populate({
						path: 'products.product',
						match: { status: 'published' }
					})
					.populate({
						path: 'looks.hotspots.product',
						match: { status: 'published' }
					})
					.lean();
			}

			if (!look) {
				look = await models.ShopTheLook.findOne({ slug: identifier.toLowerCase().trim() })
					.populate({
						path: 'products.product',
						match: { status: 'published' }
					})
					.populate({
						path: 'looks.hotspots.product',
						match: { status: 'published' }
					})
					.lean();
			}

			if (!look) {
				throw new AppError('Look not found', 'Look no encontrado', 404);
			}

			const titleOrName = look.name || look.title || 'Look';
			if (!look.name) look.name = titleOrName;
			if (!look.title) look.title = titleOrName;

			if (!look.slug) {
				const generatedSlug = await this.generateUniqueSlug(models, titleOrName, String(look._id));
				look.slug = generatedSlug;
				models.ShopTheLook.findByIdAndUpdate(look._id, { $set: { slug: generatedSlug } }).catch(() => {});
			}

			if (look.products) {
				look.products = look.products.filter((p: any) => p.product !== null && p.product !== undefined);
			}
			if (look.looks) {
				look.looks.forEach((l: any) => {
					if (l.hotspots) {
						l.hotspots = l.hotspots.filter((h: any) => h.product !== null && h.product !== undefined);
					}
				});
			}

			// Hidratación en tiempo real de imágenes de variantes
			this.hydrateLiveVariantImages(look);

			return look as unknown as IShopTheLookDocument;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error fetching Shop The Look item', 'Error al obtener el look', 500);
		}
	}

	static async createLook(models: TenantModels, data: IShopTheLook, tenantSlug?: string): Promise<IShopTheLookDocument> {
		try {
			const lookName = data.name || data.title || 'Look';
			if (!data.name) data.name = lookName;
			if (!data.title) data.title = lookName;

			if (data.slug) {
				data.slug = await this.generateUniqueSlug(models, data.slug);
			} else {
				data.slug = await this.generateUniqueSlug(models, lookName);
			}

			const baseScore = data.rankingScore !== undefined && data.rankingScore !== null && !isNaN(Number(data.rankingScore))
				? Number(data.rankingScore)
				: 100;
			data.rankingScore = baseScore;
			data.effectiveScore = baseScore;
			data.order = data.order !== undefined && !isNaN(Number(data.order)) ? Number(data.order) : 0;
			data.metrics = {
				viewsCount: 0,
				likesCount: data.likes || 0,
				sharesCount: data.shares || 0,
				cartAddsCount: 0,
				salesCount: 0
			};

			const newLook = await models.ShopTheLook.create(data);

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
				CacheService.invalidatePrefix(tenantSlug, 'home');
			}

			return newLook;
		} catch (error) {
			throw new AppError('Error creating Shop The Look item', 'Error al crear el look', 400);
		}
	}

	static async updateLook(models: TenantModels, lookId: string, data: Partial<IShopTheLook>, tenantSlug?: string): Promise<IShopTheLookDocument> {
		try {
			const isObjectId = mongoose.Types.ObjectId.isValid(lookId);
			const currentLook = (isObjectId
				? await models.ShopTheLook.findById(lookId).lean()
				: await models.ShopTheLook.findOne({ slug: lookId }).lean()) as unknown as IShopTheLookDocument;

			if (!currentLook) {
				throw new AppError('Look not found', 'Look no encontrado', 404);
			}

			const realId = currentLook._id ? String(currentLook._id) : lookId;
			const lookName = data.name || data.title || currentLook.name || currentLook.title || 'Look';

			if (data.slug) {
				data.slug = await this.generateUniqueSlug(models, data.slug, realId);
			} else if ((data.name || data.title) && (!currentLook.slug || data.name !== currentLook.name || data.title !== currentLook.title)) {
				data.slug = await this.generateUniqueSlug(models, lookName, realId);
			}

			// Gestión de borrado de imágenes de galería eliminadas
			if (data.gallery && currentLook.gallery) {
				const oldImages = currentLook.gallery.map((g: any) => g.public_id).filter(Boolean);
				const newImages = data.gallery.map((g: any) => g.public_id).filter(Boolean);
				const imagesToDelete = oldImages.filter(id => !newImages.includes(id));

				for (const publicId of imagesToDelete) {
					await ImageService.DeleteImage(publicId).catch(e => console.error('Failed to delete old gallery image', e));
				}
			}

			// Borrado de imagen SEO previa si fue reemplazada
			if (data.seo?.metaImage?.public_id && currentLook.seo?.metaImage?.public_id && data.seo.metaImage.public_id !== currentLook.seo.metaImage.public_id) {
				await ImageService.DeleteImage(currentLook.seo.metaImage.public_id).catch(e => console.error('Failed to delete replaced SEO image', e));
			}

			if (data.rankingScore !== undefined && data.rankingScore !== null && !isNaN(Number(data.rankingScore))) {
				const newBase = Number(data.rankingScore);
				data.rankingScore = newBase;
				const views = currentLook.metrics?.viewsCount || 0;
				const likes = currentLook.likes || currentLook.metrics?.likesCount || 0;
				const shares = currentLook.shares || currentLook.metrics?.sharesCount || 0;
				const carts = currentLook.metrics?.cartAddsCount || 0;
				const sales = currentLook.metrics?.salesCount || 0;

				data.effectiveScore = newBase + (views * 1) + (likes * 3) + (shares * 5) + (carts * 10) + (sales * 30);
			}

			if (data.order !== undefined && !isNaN(Number(data.order))) {
				data.order = Number(data.order);
			}

			const updatedLook = await models.ShopTheLook.findByIdAndUpdate(
				realId,
				{ $set: data },
				{ new: true, runValidators: true }
			)
			.populate({
				path: 'products.product',
				match: { status: 'published' }
			})
			.populate({
				path: 'looks.hotspots.product',
				match: { status: 'published' }
			})
			.lean();

			this.hydrateLiveVariantImages(updatedLook);

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
				CacheService.invalidatePrefix(tenantSlug, 'home');
			}

			return updatedLook as unknown as IShopTheLookDocument;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Error updating Shop The Look item', 'Error al actualizar el look', 400);
		}
	}

	static async deleteLook(models: TenantModels, lookId: string, tenantSlug?: string): Promise<void> {
		try {
			const isObjectId = mongoose.Types.ObjectId.isValid(lookId);
			const currentLook = (isObjectId
				? await models.ShopTheLook.findById(lookId).lean()
				: await models.ShopTheLook.findOne({ slug: lookId }).lean()) as unknown as IShopTheLookDocument;

			if (!currentLook) {
				throw new AppError('Look not found', 'Look no encontrado', 404);
			}

			const realId = currentLook._id ? String(currentLook._id) : lookId;

			// Borrar imágenes de galería de Cloudinary
			if (currentLook.gallery) {
				const imagesToDelete = currentLook.gallery.map((g: any) => g.public_id).filter(Boolean);
				for (const publicId of imagesToDelete) {
					await ImageService.DeleteImage(publicId).catch(e => console.error('Failed to delete gallery image', e));
				}
			}

			// Borrar imágenes legacy de Cloudinary
			if (currentLook.looks) {
				const imagesToDelete = currentLook.looks.map((l: any) => l.mainImage?.public_id).filter(Boolean);
				for (const publicId of imagesToDelete) {
					await ImageService.DeleteImage(publicId).catch(e => console.error('Failed to delete legacy image', e));
				}
			}

			// Borrar imagen SEO de Cloudinary si existe
			if (currentLook.seo?.metaImage?.public_id) {
				await ImageService.DeleteImage(currentLook.seo.metaImage.public_id).catch(e => console.error('Failed to delete SEO image', e));
			}

			await models.ShopTheLook.findByIdAndDelete(realId);

			if (tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
				CacheService.invalidatePrefix(tenantSlug, 'home');
			}
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error deleting Shop The Look item', 'Error al eliminar el look', 400);
		}
	}

	static async trackEngagement(
		models: TenantModels,
		lookId: string,
		action: 'like' | 'share' | 'view' | 'cart',
		tenantSlug?: string
	): Promise<{ likes: number; shares: number; effectiveScore: number; metrics?: any }> {
		const isObjectId = mongoose.Types.ObjectId.isValid(lookId);
		const filter = isObjectId ? { _id: lookId } : { slug: lookId };

		// Pesos de ELO
		const weights: Record<string, number> = {
			view: 1,
			like: 3,
			share: 5,
			cart: 10
		};

		const scoreIncrement = weights[action] || 1;
		const incUpdate: Record<string, number> = {
			effectiveScore: scoreIncrement
		};

		if (action === 'view') {
			incUpdate['metrics.viewsCount'] = 1;
		} else if (action === 'like') {
			incUpdate['likes'] = 1;
			incUpdate['metrics.likesCount'] = 1;
		} else if (action === 'share') {
			incUpdate['shares'] = 1;
			incUpdate['metrics.sharesCount'] = 1;
		} else if (action === 'cart') {
			incUpdate['metrics.cartAddsCount'] = 1;
		}

		const updated = await models.ShopTheLook.findOneAndUpdate(
			filter,
			{ $inc: incUpdate },
			{ new: true, select: 'likes shares metrics effectiveScore rankingScore' }
		).lean();

		if (!updated) {
			throw new AppError('Look not found', 'Look no encontrado', 404);
		}

		if (tenantSlug) {
			const { CacheService } = await import('@/services/cache.service');
			CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
			CacheService.invalidatePrefix(tenantSlug, 'home');
		}

		return {
			likes: updated.likes || 0,
			shares: updated.shares || 0,
			effectiveScore: updated.effectiveScore || 0,
			metrics: updated.metrics
		};
	}

	static async updateRankingScore(
		models: TenantModels,
		lookId: string,
		data: { rankingScore?: number; order?: number },
		tenantSlug?: string
	): Promise<IShopTheLookDocument> {
		const isObjectId = mongoose.Types.ObjectId.isValid(lookId);
		const filter = isObjectId ? { _id: lookId } : { slug: lookId };
		const look = await models.ShopTheLook.findOne(filter);

		if (!look) {
			throw new AppError('Look not found', 'Look no encontrado', 404);
		}

		if (data.rankingScore !== undefined && !isNaN(Number(data.rankingScore))) {
			const newBase = Number(data.rankingScore);
			look.rankingScore = newBase;
			const views = look.metrics?.viewsCount || 0;
			const likes = look.likes || look.metrics?.likesCount || 0;
			const shares = look.shares || look.metrics?.sharesCount || 0;
			const carts = look.metrics?.cartAddsCount || 0;
			const sales = look.metrics?.salesCount || 0;

			look.effectiveScore = newBase + (views * 1) + (likes * 3) + (shares * 5) + (carts * 10) + (sales * 30);
		}

		if (data.order !== undefined && !isNaN(Number(data.order))) {
			look.order = Number(data.order);
		}

		await look.save();

		if (tenantSlug) {
			const { CacheService } = await import('@/services/cache.service');
			CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
			CacheService.invalidatePrefix(tenantSlug, 'home');
		}

		return look;
	}

	/**
	 * Reinicia masivamente los scores ELO de todos los looks a su base.
	 */
	static async resetAllToRankingBase(
		models: TenantModels,
		resetBaseTo100: boolean = false,
		tenantSlug?: string
	): Promise<{ updatedCount: number }> {
		const looks = await models.ShopTheLook.find({}).select('_id rankingScore');
		if (!looks || looks.length === 0) {
			return { updatedCount: 0 };
		}

		const bulkOps = looks.map((look) => {
			const targetBase = resetBaseTo100 ? 100 : (look.rankingScore !== undefined && look.rankingScore !== null ? Number(look.rankingScore) : 100);
			return {
				updateOne: {
					filter: { _id: look._id },
					update: {
						$set: {
							rankingScore: targetBase,
							effectiveScore: targetBase,
							'metrics.viewsCount': 0,
							'metrics.likesCount': 0,
							'metrics.sharesCount': 0,
							'metrics.cartAddsCount': 0,
							'metrics.salesCount': 0
						}
					}
				}
			};
		});

		const result = await models.ShopTheLook.bulkWrite(bulkOps);

		if (tenantSlug) {
			const { CacheService } = await import('@/services/cache.service');
			CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
			CacheService.invalidatePrefix(tenantSlug, 'home');
		}

		return { updatedCount: result.modifiedCount || bulkOps.length };
	}

	/**
	 * Reinicia el score ELO de un look individual a su base.
	 */
	static async resetLookRankingBase(
		models: TenantModels,
		lookId: string,
		resetBaseTo100: boolean = false,
		tenantSlug?: string
	): Promise<IShopTheLookDocument> {
		const isObjectId = mongoose.Types.ObjectId.isValid(lookId);
		const filter = isObjectId ? { _id: lookId } : { slug: lookId };
		const look = await models.ShopTheLook.findOne(filter);

		if (!look) {
			throw new AppError('Look not found', 'Look no encontrado', 404);
		}

		const targetBase = resetBaseTo100 ? 100 : (look.rankingScore !== undefined && look.rankingScore !== null ? Number(look.rankingScore) : 100);
		look.rankingScore = targetBase;
		look.effectiveScore = targetBase;
		if (!look.metrics) {
			look.metrics = { viewsCount: 0, likesCount: 0, sharesCount: 0, cartAddsCount: 0, salesCount: 0 };
		} else {
			look.metrics.viewsCount = 0;
			look.metrics.likesCount = 0;
			look.metrics.sharesCount = 0;
			look.metrics.cartAddsCount = 0;
			look.metrics.salesCount = 0;
		}

		await look.save();

		if (tenantSlug) {
			const { CacheService } = await import('@/services/cache.service');
			CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
			CacheService.invalidatePrefix(tenantSlug, 'home');
		}

		return look;
	}

	static async recordProductSaleInLooks(
		models: TenantModels,
		productId: string,
		quantity: number = 1,
		tenantSlug?: string
	): Promise<void> {
		try {
			const saleWeight = 30;
			const scoreIncrement = saleWeight * quantity;
			const res = await models.ShopTheLook.updateMany(
				{ 'products.product': productId },
				{
					$inc: {
						'metrics.salesCount': quantity,
						effectiveScore: scoreIncrement
					}
				}
			);
			if (res.modifiedCount > 0 && tenantSlug) {
				const { CacheService } = await import('@/services/cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'shopthelook');
				CacheService.invalidatePrefix(tenantSlug, 'home');
			}
		} catch (error) {
			console.error('[ShopTheLookService] Error recording sale in looks:', error);
		}
	}
}
