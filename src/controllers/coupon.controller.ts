import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { CouponService } from '@/services/coupon.service';
import { AppError } from '@/errors/app.error';

export class CouponController {
	/**
	 * Endpoint público para validar un cupón de descuento.
	 * POST /api/v1/coupons/validate
	 */
	static async validateCoupon(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const { code, subtotal, email, paymentMethod, items } = req.body;
		const userId = req.user?._id ? String(req.user._id) : undefined;

		const result = await CouponService.validateCoupon(models, {
			code,
			subtotal: Number(subtotal) || 0,
			email,
			userId,
			paymentMethod,
			items
		});

		res.status(200).json(result);
	}

	/**
	 * Endpoint público para consultar si el usuario actual/email califica para 10% OFF primera compra.
	 * GET /api/v1/coupons/check-first-purchase
	 */
	static async checkFirstPurchase(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const email = (req.query.email as string) || req.user?.email;
		const userId = req.user?._id ? String(req.user._id) : undefined;

		const result = await CouponService.checkFirstPurchaseEligibility(models, email, userId);
		res.status(200).json(result);
	}

	static async getMyCoupons(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const email = (req.query.email as string) || req.user?.email;
		const userId = req.user?._id ? String(req.user._id) : undefined;

		const coupons = await CouponService.getUserAvailableCoupons(models, email, userId);
		res.status(200).json(coupons);
	}

	// ── ENDPOINTS DE ADMINISTRACIÓN (Panel de Control) ──────────────────────

	static async getAllCoupons(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const coupons = await CouponService.getAllCoupons(models);
		res.status(200).json(coupons);
	}

	static async createCoupon(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const coupon = await CouponService.createCoupon(models, req.body);
		res.status(201).json(coupon);
	}

	static async toggleCoupon(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const coupon = await CouponService.toggleCouponStatus(models, req.params.id);
		res.status(200).json(coupon);
	}

	static async deleteCoupon(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		await CouponService.deleteCoupon(models, req.params.id);
		res.status(200).json({ message: 'Cupón eliminado exitosamente' });
	}

	static async getFirstPurchaseConfig(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const config = await CouponService.getFirstPurchaseConfig(models);
		res.status(200).json(config);
	}

	static async updateFirstPurchaseConfig(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const { enabled, percentage } = req.body;
		const config = await CouponService.updateFirstPurchaseConfig(models, enabled, percentage);
		res.status(200).json(config);
	}
}
