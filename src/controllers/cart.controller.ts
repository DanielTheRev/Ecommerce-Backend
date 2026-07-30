import { AuthRequest } from '../middleware/auth';
import { CartService } from '../services/cart.service';
import { NextFunction, Response } from 'express';

export class CartController {
	static async getCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const result = await CartService.getCart(req.models!, userId);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	static async updateCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const result = await CartService.updateCart(req.models!, userId, req.body);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	static async mergeCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const guestItems = req.body.items || [];
			const result = await CartService.mergeCart(req.models!, userId, guestItems);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	static async clearCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const result = await CartService.clearCart(req.models!, userId);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}
}
