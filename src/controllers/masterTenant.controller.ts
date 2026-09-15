import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { MasterAuthRequest } from '@/middleware/masterAuth.middleware';
import { MasterTenantService } from '@/services/masterTenant.service';
import { AppError } from '@/errors/app.error';

export class MasterTenantController {
	/**
	 * POST /api/master/auth/login
	 * Iniciar sesión de SuperAdmin en la Master Console.
	 */
	static async login(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { masterKey, password } = req.body;
			const configuredKey = process.env.MASTER_ADMIN_KEY || 'vex_master_secret_2026';

			const inputKey = (masterKey || password || '').trim();

			if (!inputKey || inputKey !== configuredKey) {
				throw new AppError('Invalid Credentials', 'Clave de acceso de SuperAdmin incorrecta.', 401);
			}

			// Emitir token JWT maestro de 7 días
			const token = jwt.sign(
				{
					email: 'master@vex.ar',
					role: 'superadmin',
					isMaster: true
				},
				process.env.JWT_SECRET!,
				{ expiresIn: '7d' }
			);

			res.status(200).json({
				success: true,
				message: 'Acceso concedido a Master Console',
				token,
				user: {
					email: 'master@vex.ar',
					role: 'superadmin',
					platform: 'VEX'
				}
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/auth/me
	 * Verificar estado de sesión activa de SuperAdmin.
	 */
	static async getMe(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			res.status(200).json({
				success: true,
				user: req.masterUser
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/tenants
	 * Obtener listado de todos los comercios registrados.
	 */
	static async getTenants(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const tenants = await MasterTenantService.listTenants();
			res.status(200).json({
				success: true,
				count: tenants.length,
				data: tenants
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/master/tenants
	 * Crear y aprovisionar un nuevo comercio.
	 */
	static async createTenant(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const result = await MasterTenantService.createTenant(req.body);
			res.status(201).json({
				success: true,
				message: 'Comercio creado y base de datos inicializada con éxito.',
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/master/tenants/:id/status
	 * Activar o suspender acceso inmediato (Kill Switch).
	 */
	static async toggleStatus(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const { isActive } = req.body;

			if (typeof isActive !== 'boolean') {
				throw new AppError('Validation Error', 'Se requiere el valor booleano isActive.', 400);
			}

			const tenant = await MasterTenantService.toggleTenantStatus(id, isActive);
			res.status(200).json({
				success: true,
				message: isActive ? 'Comercio activado.' : 'Comercio pausado/suspendido.',
				data: tenant
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/master/tenants/:id/subscription
	 * Actualizar estado de facturación / suscripción.
	 */
	static async updateSubscription(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const { subscriptionStatus } = req.body;

			if (!['active', 'past_due', 'suspended', 'trial'].includes(subscriptionStatus)) {
				throw new AppError('Validation Error', 'Estado de suscripción inválido.', 400);
			}

			const tenant = await MasterTenantService.updateSubscriptionStatus(id, subscriptionStatus);
			res.status(200).json({
				success: true,
				message: `Suscripción actualizada a "${subscriptionStatus}".`,
				data: tenant
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/master/tenants/:id/plan
	 * Actualizar plan contratado.
	 */
	static async updatePlan(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const { plan } = req.body;

			if (!['free', 'basic', 'premium'].includes(plan)) {
				throw new AppError('Validation Error', 'Plan inválido.', 400);
			}

			const tenant = await MasterTenantService.updateTenantPlan(id, plan);
			res.status(200).json({
				success: true,
				message: `Plan actualizado a "${plan}".`,
				data: tenant
			});
		} catch (error) {
			next(error);
		}
	}
}
