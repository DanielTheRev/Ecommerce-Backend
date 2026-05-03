import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { IFavorite } from '@/interfaces/favorites.interface';

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
}
