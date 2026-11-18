import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { ProductBundleService } from '@/services/productBundle.service';
import { AppError } from '@/errors/app.error';

export class ProductBundleController {
	/**
	 * POST /api/product-bundles
	 * Crea un nuevo combo / conjunto de productos (Admin).
	 */
	public static async createBundle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const bundle = await ProductBundleService.createBundle(models, req.body);

			res.status(201).json({
				success: true,
				message: 'Conjunto de productos creado exitosamente',
				data: bundle
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PUT /api/product-bundles/:id
	 * Actualiza un combo (Admin).
	 */
	public static async updateBundle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const bundle = await ProductBundleService.updateBundle(models, req.params.id, req.body);

			res.status(200).json({
				success: true,
				message: 'Conjunto de productos actualizado exitosamente',
				data: bundle
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /api/product-bundles/:id
	 * Elimina un combo (Admin).
	 */
	public static async deleteBundle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			await ProductBundleService.deleteBundle(models, req.params.id);

			res.status(200).json({
				success: true,
				message: 'Conjunto de productos eliminado exitosamente'
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/product-bundles/:idOrSlug
	 * Obtiene un combo con stock virtual reactivo calculado en tiempo real.
	 */
	public static async getBundle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const bundle = await ProductBundleService.getBundleByIdOrSlug(models, req.params.idOrSlug);

			res.status(200).json({
				success: true,
				data: bundle
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/product-bundles
	 * Obtiene todos los combos con stock virtual en vivo.
	 */
	public static async getAllBundles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const activeOnly = req.query.activeOnly !== 'false'; // Por defecto solo activos para el storefront
			const bundles = await ProductBundleService.getAllBundles(models, activeOnly);

			res.status(200).json({
				success: true,
				data: bundles
			});
		} catch (error) {
			next(error);
		}
	}
}
