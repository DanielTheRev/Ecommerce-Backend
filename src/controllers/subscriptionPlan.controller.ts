import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/errors/app.error';
import { SubscriptionPlanService } from '@/services/subscriptionPlan.service';
import { connectionManager } from '@/config/multitenancy';
import { ITenant } from '@/interfaces/tenant.interface';

export class SubscriptionPlanController {
	private static formatZodError(err: ZodError): AppError {
		const details = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(' | ');
		return new AppError('Validation Error', `Datos inválidos en el plan: ${details}`, 400);
	}

	/**
	 * GET /api/master/plans
	 * Lista todos los planes de suscripción de la plataforma (con conteo de comercios activos por plan).
	 */
	static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const includeInactive = req.query.activeOnly !== 'true';
			const plans = await SubscriptionPlanService.listAllPlans(includeInactive);

			let usageMap = new Map<string, number>();
			try {
				const masterDb = connectionManager.getMasterDb();
				const TenantModel = masterDb.model<ITenant>('Tenant');
				const usageAgg = await TenantModel.aggregate<{ _id: string; count: number }>([
					{ $match: { isActive: true, planTier: { $type: 'string', $ne: '' } } },
					{ $group: { _id: '$planTier', count: { $sum: 1 } } }
				]);
				usageMap = new Map<string, number>(usageAgg.map((r) => [r._id, r.count]));
			} catch {
				// Si masterDb no tiene conexión en tests unitarios, devolver 0
			}

			const enriched = plans.map((p) => ({
				...p,
				activeTenantsCount: usageMap.get(p.code) || 0
			}));

			res.status(200).json({
				success: true,
				count: enriched.length,
				data: enriched
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/plans/:code
	 */
	static async getByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const plan = await SubscriptionPlanService.getPlanByCode(req.params.code);
			res.status(200).json({
				success: true,
				data: plan
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/master/plans
	 */
	static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const created = await SubscriptionPlanService.createPlan(req.body);
			res.status(201).json({
				success: true,
				message: `Plan '${created.name}' (${created.code}) creado exitosamente.`,
				data: created
			});
		} catch (error) {
			if (error instanceof ZodError) {
				next(this.formatZodError(error));
				return;
			}
			next(error);
		}
	}

	/**
	 * PUT /api/master/plans/:code
	 */
	static async updateByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const updated = await SubscriptionPlanService.updatePlan(req.params.code, req.body);
			res.status(200).json({
				success: true,
				message: `Plan '${updated.name}' (${updated.code}) actualizado exitosamente.`,
				data: updated
			});
		} catch (error) {
			if (error instanceof ZodError) {
				next(this.formatZodError(error));
				return;
			}
			next(error);
		}
	}

	/**
	 * DELETE /api/master/plans/:code
	 */
	static async deleteByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const result = await SubscriptionPlanService.deletePlan(req.params.code);
			res.status(200).json({
				success: true,
				message: `Plan '${result.deletedCode}' eliminado correctamente.`,
				data: result
			});
		} catch (error) {
			next(error);
		}
	}
}
