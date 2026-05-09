import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { IFavorite } from '@/interfaces/favorites.interface';
import { ResendService } from './resend.service';

export class FavoritesService {

	/**
	 * Obtiene todos los favoritos del usuario con el producto populado.
	 */
	static async getUserFavorites(models: TenantModels, userId: string): Promise<IFavorite[]> {
		const favorites = await models.Favorite.find({ user: userId })
			.populate({
				path: 'product',
				select: 'brand model images prices discount slug productType isActive isFeatured category'
			})
			.sort({ createdAt: -1 })
			.lean()
			.exec();

		return favorites.map(fav => ({
			...fav,
			_id: fav._id.toString()
		})) as unknown as IFavorite[];
	}

	/**
	 * Agrega un producto a los favoritos del usuario.
	 * Es idempotente: si ya existe, devuelve el favorito existente sin lanzar error.
	 */
	static async addFavorite(models: TenantModels, userId: string, productId: string): Promise<IFavorite> {
		// Verificar que el producto existe
		const product = await models.Product.findById(productId).lean().exec();
		if (!product) {
			throw new AppError('Product not found', 'El producto no existe', 404);
		}

		// findOneAndUpdate con upsert para evitar duplicados de forma atómica
		const favorite = await models.Favorite.findOneAndUpdate(
			{ user: userId, product: productId },
			{ user: userId, product: productId },
			{ upsert: true, new: true, setDefaultsOnInsert: true }
		)
			.populate({
				path: 'product',
				select: 'brand model images prices discount slug productType isActive isFeatured category'
			})
			.lean()
			.exec();

		return { ...favorite, _id: favorite!._id.toString() } as unknown as IFavorite;
	}

	/**
	 * Elimina un producto de los favoritos del usuario.
	 */
	static async removeFavorite(models: TenantModels, userId: string, productId: string): Promise<void> {
		const deleted = await models.Favorite.findOneAndDelete({
			user: userId,
			product: productId
		});

		if (!deleted) {
			throw new AppError('Favorite not found', 'El favorito no existe', 404);
		}
	}

	/**
	 * Chequea si un producto es favorito del usuario.
	 */
	static async isFavorite(models: TenantModels, userId: string, productId: string): Promise<boolean> {
		const exists = await models.Favorite.exists({ user: userId, product: productId });
		return !!exists;
	}

	// ==================== ADMIN METHODS ====================

	/**
	 * Obtiene todos los productos que tienen favoritos, agrupados por producto,
	 * con el conteo de usuarios y los datos de cada usuario.
	 */
	static async getFavoritesByProduct(models: TenantModels) {
		const results = await models.Favorite.aggregate([
			{
				$group: {
					_id: '$product',
					favoritesCount: { $sum: 1 },
					users: { $push: '$user' }
				}
			},
			{ $sort: { favoritesCount: -1 } },
			{
				$lookup: {
					from: 'products',
					localField: '_id',
					foreignField: '_id',
					as: 'product'
				}
			},
			{ $unwind: '$product' },
			{
				$lookup: {
					from: 'users',
					localField: 'users',
					foreignField: '_id',
					as: 'users'
				}
			},
			{
				$project: {
					_id: 0,
					product: {
						_id: 1,
						brand: 1,
						model: 1,
						slug: 1,
						images: 1,
						'prices.efectivo_transferencia': 1,
						'prices.tarjeta_credito_debito': 1,
						isActive: 1,
						category: 1
					},
					favoritesCount: 1,
					users: {
						_id: 1,
						name: 1,
						email: 1
					}
				}
			}
		]);

		return results;
	}

	/**
	 * Envía un email de "volvió al stock" a todos los usuarios que tienen
	 * un producto en sus favoritos.
	 */
	static async notifyBackInStock(models: TenantModels, productId: string): Promise<{ sentCount: number; failedCount: number }> {
		// 1. Buscar el producto
		const product = await models.Product.findById(productId)
			.select('brand model slug images prices.efectivo_transferencia')
			.lean()
			.exec();

		if (!product) {
			throw new AppError('Product not found', 'El producto no existe', 404);
		}

		// 2. Buscar todos los favoritos de este producto con usuario populado
		const favorites = await models.Favorite.find({ product: productId })
			.populate({ path: 'user', select: 'name email' })
			.lean()
			.exec();

		if (favorites.length === 0) {
			throw new AppError('No favorites found', 'Ningún usuario tiene este producto en favoritos', 404);
		}

		// 3. Enviar email a cada usuario
		let sentCount = 0;
		let failedCount = 0;

		const productData = {
			brand: (product as any).brand,
			model: (product as any).model,
			slug: (product as any).slug,
			images: (product as any).images,
			prices: { efectivo_transferencia: (product as any).prices?.efectivo_transferencia || 0 }
		};

		for (const fav of favorites) {
			const user = fav.user as any;
			if (!user?.email) {
				failedCount++;
				continue;
			}

			const success = await ResendService.sendBackInStockEmail(
				user.email,
				user.name || 'Cliente',
				productData
			);

			if (success) {
				sentCount++;
			} else {
				failedCount++;
			}
		}

		return { sentCount, failedCount };
	}
}

