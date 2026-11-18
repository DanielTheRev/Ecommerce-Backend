import { Response, NextFunction } from 'express';
import { MasterAuthRequest } from '@/middleware/masterAuth.middleware';
import { MasterTenantService } from '@/services/masterTenant.service';
import { TenantHealthService } from '@/services/tenantHealth.service';
import { MasterAuthService } from '@/services/auth/masterAuth.service';
import { AppError } from '@/errors/app.error';

export class MasterTenantController {
	/**
	 * POST /api/master/auth/login
	 * Iniciar sesión de SuperAdmin / Operador en console.vexx.
	 */
	static async login(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { email, password, rememberMe } = req.body || {};
			const result = await MasterAuthService.login({
				email,
				password,
				rememberMe: Boolean(rememberMe)
			});

			const maxAgeMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
			res.cookie('vexx_master_token', result.token, {
				expires: new Date(Date.now() + maxAgeMs),
				maxAge: maxAgeMs,
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
			});

			res.status(200).json({
				success: true,
				message: 'Acceso concedido a Master Console',
				token: result.token,
				user: result.user
			});
		} catch (error) {
			next(error);
		}
	}

	static async forgotPassword(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const result = await MasterAuthService.forgotPassword(req.body?.email);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	static async resetPassword(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { token, newPassword, email } = req.body || {};
			const result = await MasterAuthService.resetPassword({ token, newPassword, email });
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	static async logout(_req: MasterAuthRequest, res: Response): Promise<void> {
		res.clearCookie('vexx_master_token', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
		});
		res.status(200).json({ success: true, message: 'Sesión maestra cerrada.' });
	}

	static async listOperators(_req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const operators = await MasterAuthService.listOperators();
			res.status(200).json({ success: true, count: operators.length, data: operators });
		} catch (error) {
			next(error);
		}
	}

	static async createOperator(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const created = await MasterAuthService.createOperator(req.body || {});
			res.status(201).json({ success: true, message: 'Operador creado.', data: created });
		} catch (error) {
			next(error);
		}
	}

	static async updateOperator(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const updated = await MasterAuthService.updateOperator(req.params.id, req.body || {});
			res.status(200).json({ success: true, message: 'Operador actualizado.', data: updated });
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
	 * GET /api/master/tenants/:id
	 * Obtener detalle individual de un comercio con sus métricas.
	 */
	static async getTenantById(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const tenant = await MasterTenantService.getTenantById(id);
			res.status(200).json({
				success: true,
				data: tenant
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/master/tenants
	 * Crear y aprovisionar un nuevo comercio (Wizard de Alta).
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
	 * PUT /api/master/tenants/:id
	 * Actualizar datos generales del comercio.
	 */
	static async updateTenant(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const tenant = await MasterTenantService.updateTenant(id, req.body);
			res.status(200).json({
				success: true,
				message: 'Comercio actualizado con éxito.',
				data: tenant
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
	 * Actualizar plan modular, add-ons y empleados extras (Upgrades de venta).
	 */
	static async updatePlan(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const { planTier, activeAddons, extraEmployeesPurchased, plan } = req.body;
			const tierToUse = planTier || plan;

			if (!tierToUse) {
				throw new AppError('Validation Error', 'El plan (planTier) es obligatorio.', 400);
			}

			const tenant = await MasterTenantService.updateTenantPlanAndAddons(
				id,
				tierToUse,
				activeAddons,
				extraEmployeesPurchased
			);
			res.status(200).json({
				success: true,
				message: `Plan actualizado a "${tierToUse}".`,
				data: tenant
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/master/tenants/:id/business-type
	 * Actualizar rubro comercial del comercio (Exclusivo SuperAdmin).
	 */
	static async updateBusinessType(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const { businessType } = req.body;

			if (!businessType) {
				throw new AppError('Validation Error', 'El rubro comercial (businessType) es requerido.', 400);
			}

			const tenant = await MasterTenantService.updateTenantBusinessType(id, businessType);
			res.status(200).json({
				success: true,
				message: `Rubro comercial actualizado a "${businessType}".`,
				data: tenant
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/master/tenants/:id/reset-password
	 * Restablecer contraseña del dueño del comercio (Soporte técnico).
	 */
	static async resetOwnerPassword(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const { newPassword } = req.body;
			const result = await MasterTenantService.resetOwnerPassword(id, newPassword);
			res.status(200).json({
				success: true,
				message: 'Contraseña del administrador del comercio restablecida.',
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/tenants/health-summary
	 * Resumen masivo de salud para la tabla de comercios del SuperAdmin.
	 */
	static async getTenantsHealthSummary(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const summary = await TenantHealthService.getHealthSummary();
			res.status(200).json({
				success: true,
				data: summary
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/tenants/:id/health
	 * Diagnóstico de salud en tiempo real (modo lectura) para un comercio.
	 */
	static async getTenantHealth(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const health = await TenantHealthService.checkTenantHealth(id);
			res.status(200).json({
				success: true,
				data: health
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/tenants/:id/bootstrap-preview
	 * Devuelve el payload completo resuelto de /api/tenant/bootstrap para un comercio
	 * (navigation.sidebarGroups, navigation.settingsTabs, modules, forms.product, storefront, capabilities)
	 * para que desde console.vexx se pueda auditar y previsualizar exactamente qué ve ese cliente.
	 */
	static async getTenantBootstrapPreview(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const role = req.query.role === 'employee' ? 'employee' : 'admin';
			const { connectionManager } = await import('@/config/multitenancy');
			const { getModelsForConnection } = await import('@/config/modelRegistry');
			const { TenantBootstrapService } = await import('@/services/tenantBootstrap.service');

			const { ITenant } = await import('@/interfaces/tenant.interface') as any;
			const masterDb = connectionManager.getMasterDb();
			const TenantModel = masterDb.model('Tenant');
			const tenant = (await TenantModel.findById(id).lean()) as import('@/interfaces/tenant.interface').ITenant | null;
			if (!tenant) {
				throw new AppError('Tenant Not Found', 'Comercio no encontrado.', 404);
			}

			const tenantDb = connectionManager.getTenantDb(tenant.dbName);
			const models = getModelsForConnection(tenantDb);

			const previewPayload = await TenantBootstrapService.buildBootstrapPayload(models, tenant, {
				_id: 'master_preview',
				name: 'Vista Previa',
				lastName: 'Console Vexx',
				email: tenant.ownerContact?.email || 'preview@vexx.com.ar',
				role,
				permissions: role === 'admin' ? ['*'] : []
			});

			res.status(200).json({
				success: true,
				data: previewPayload
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/master/tenants/:id/repair-bootstrap
	 * Crea documentos base faltantes (ej. EcommerceConfig) sin pisar datos ni productos existentes.
	 */
	static async repairTenantBootstrap(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const result = await TenantHealthService.repairTenantBootstrap(id);
			res.status(200).json({
				success: true,
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * DELETE /api/master/tenants/:id
	 * Pausar y archivar un comercio.
	 */
	static async deleteTenant(req: MasterAuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const result = await MasterTenantService.deleteTenant(id);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}
}
