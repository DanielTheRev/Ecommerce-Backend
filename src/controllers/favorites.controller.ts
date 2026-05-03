import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { FavoritesService } from '@/services/favorites.service';

export class FavoritesController {

	static async getUserFavorites(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const favorites = await FavoritesService.getUserFavorites(req.models!, req.user!._id);
			res.status(200).json({ success: true, count: favorites.length, data: favorites });
		} catch (error) {
			next(error);
		}
	}

	static async addFavorite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { productId } = req.body;
			const favorite = await FavoritesService.addFavorite(req.models!, req.user!._id, productId);
			res.status(201).json({ success: true, data: favorite });
		} catch (error) {
			next(error);
		}
	}

	static async removeFavorite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			await FavoritesService.removeFavorite(req.models!, req.user!._id, req.params.productId);
			res.status(200).json({ success: true, data: {} });
		} catch (error) {
			next(error);
		}
	}

	static async isFavorite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const isFav = await FavoritesService.isFavorite(req.models!, req.user!._id, req.params.productId);
			res.status(200).json({ success: true, data: { isFavorite: isFav } });
		} catch (error) {
			next(error);
		}
	}
}
