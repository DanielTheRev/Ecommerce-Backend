import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { DataSetService } from '@/services/dataSet.service';
import { AppError } from '@/errors/app.error';

export class DataSetController {
	/**
	 * POST /api/data-sets
	 * Crea un nuevo conjunto de datos (Admin).
	 */
	public static async createDataSet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const planTier = req.tenant?.planTier;
			const dataSet = await DataSetService.createDataSet(models, req.body, planTier);

			res.status(201).json({
				success: true,
				message: 'Conjunto de datos creado exitosamente',
				data: dataSet
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PUT /api/data-sets/:id
	 * Actualiza un conjunto de datos (Admin).
	 */
	public static async updateDataSet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const planTier = req.tenant?.planTier;
			const dataSet = await DataSetService.updateDataSet(models, req.params.id, req.body, planTier);

			res.status(200).json({
				success: true,
				message: 'Conjunto de datos actualizado exitosamente',
				data: dataSet
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /api/data-sets/:id
	 * Elimina un conjunto de datos (Admin).
	 */
	public static async deleteDataSet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			await DataSetService.deleteDataSet(models, req.params.id);

			res.status(200).json({
				success: true,
				message: 'Conjunto de datos eliminado exitosamente'
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/data-sets/:idOrSlug
	 * Obtiene la configuración de un conjunto de datos.
	 */
	public static async getDataSet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const dataSet = await DataSetService.getDataSetByIdOrSlug(models, req.params.idOrSlug);

			res.status(200).json({
				success: true,
				data: dataSet
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/data-sets
	 * Obtiene el listado de conjuntos de datos del tenant.
	 */
	public static async getAllDataSets(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const activeOnly = req.query.activeOnly === 'true';
			const dataSets = await DataSetService.getAllDataSets(models, activeOnly);

			res.status(200).json({
				success: true,
				data: dataSets
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/data-sets/:idOrSlug/execute
	 * Ejecuta la consulta dinámica del conjunto y devuelve los productos y combos coincidentes en vivo.
	 */
	public static async executeDataSet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const models = req.models;
			if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

			const planTier = req.tenant?.planTier;
			const result = await DataSetService.executeDataSet(models, req.params.idOrSlug, planTier);

			res.status(200).json({
				success: true,
				data: result
			});
		} catch (error) {
			next(error);
		}
	}
}
