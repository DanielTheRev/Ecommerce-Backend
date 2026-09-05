import { Request, Response, NextFunction } from 'express';
import { CategoryGroupService } from '@/services/categoryGroup.service';

export class CategoryGroupController {
	/**
	 * Obtiene todos los grupos de categorías
	 */
	static async getCategoryGroups(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = (req as any).models;
			const tenantSlug = (req as any).tenant?.slug || req.body?.tenantSlug;
			const groups = await CategoryGroupService.getCategoryGroups(models, tenantSlug);

			res.status(200).json({
				success: true,
				data: groups
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Obtiene todas las categorías directas/reales de los productos del tenant con sus conteos
	 */
	static async getDistinctRawCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = (req as any).models;
			const categories = await CategoryGroupService.getDistinctRawCategories(models);

			res.status(200).json({
				success: true,
				data: categories
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Obtiene un grupo por slug o ID
	 */
	static async getCategoryGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = (req as any).models;
			const { idOrSlug } = req.params;
			const tenantSlug = (req as any).tenant?.slug || req.body?.tenantSlug;
			const group = await CategoryGroupService.getCategoryGroupByIdOrSlug(models, idOrSlug, tenantSlug);

			if (!group) {
				res.status(404).json({
					success: false,
					message: `Grupo de categoría "${idOrSlug}" no encontrado.`
				});
				return;
			}

			res.status(200).json({
				success: true,
				data: group
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Crea un nuevo grupo de categoría
	 */
	static async createCategoryGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = (req as any).models;
			const tenantSlug = (req as any).tenant?.slug;
			const payload = req.body;

			const group = await CategoryGroupService.createCategoryGroup(models, payload, tenantSlug);

			res.status(201).json({
				success: true,
				message: 'Grupo de categoría creado exitosamente.',
				data: group
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Actualiza un grupo de categoría existente
	 */
	static async updateCategoryGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = (req as any).models;
			const { id } = req.params;
			const tenantSlug = (req as any).tenant?.slug;
			const payload = req.body;

			const group = await CategoryGroupService.updateCategoryGroup(models, id, payload, tenantSlug);

			res.status(200).json({
				success: true,
				message: 'Grupo de categoría actualizado exitosamente.',
				data: group
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * Elimina un grupo de categoría
	 */
	static async deleteCategoryGroup(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = (req as any).models;
			const { id } = req.params;
			const tenantSlug = (req as any).tenant?.slug;

			await CategoryGroupService.deleteCategoryGroup(models, id, tenantSlug);

			res.status(200).json({
				success: true,
				message: 'Grupo de categoría eliminado exitosamente.'
			});
		} catch (error) {
			next(error);
		}
	}
}
