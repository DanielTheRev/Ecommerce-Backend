import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { getEffectivePlanCapabilities, getEffectiveMaxEmployees } from '@/config/planCapabilities';
import { resolveProductFormConfig, resolveProductListViewConfig } from '@/config/formCapabilities';
import { EcommerceService } from '@/services/ecommerce.service';
import { AppError } from '@/errors/app.error';
import { validateTenantSubscriptionIntegrity } from '@/middleware/planGuard';

export class TenantBootstrapController {
	/**
	 * GET /api/tenant/bootstrap
	 * Endpoint de arranque universal para Frontend (Angular) y Android.
	 * Devuelve todo lo que la aplicación necesita para inicializarse en una sola llamada:
	 * Perfil del usuario autenticado, permisos asignados, capacidades del plan,
	 * capacidades del rubro y configuración de formularios (@if).
	 * Accesible tanto para Administrador como para Empleados.
	 */
	static async getBootstrapData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.user) {
				throw new AppError('Unauthorized', 'Usuario no autenticado', 401);
			}
			if (!req.tenant || !req.models) {
				throw new AppError('Tenant not resolved', 'Error crítico: no se pudo resolver el comercio.', 500);
			}

			validateTenantSubscriptionIntegrity(req.tenant);

			const planTier = req.tenant.planTier;
			const businessType = req.tenant.businessType;

			// 1. Capacidades Efectivas Únicas (Intersección estricta de Plan x Rubro)
			const effectiveCapabilities = getEffectivePlanCapabilities(planTier, businessType);

			// 2. Configuración de tienda (EcommerceConfig)
			const storeConfig = await EcommerceService.getConfig(req.models);

			// 3. Configuración dinámica de formularios de producto (@if)
			const acceptsInstallments = Boolean(storeConfig.pricingStrategy?.absorbInstallments);
			const formConfig = resolveProductFormConfig(businessType, planTier, acceptsInstallments);
			const productListViewConfig = resolveProductListViewConfig(businessType, planTier);

			// 4. Límite de empleados efectivo (Base 10 + Extras comprados)
			const maxEmployeesAllowed = getEffectiveMaxEmployees(planTier, req.tenant.extraEmployeesPurchased);

			// 5. Permisos efectivos del usuario
			const isAdmin = req.user.role === 'admin';
			const permissions = isAdmin ? ['*'] : (req.user.permissions || []);

			res.status(200).json({
				success: true,
				data: {
					user: {
						_id: req.user._id,
						name: req.user.name,
						lastName: req.user.lastName,
						email: req.user.email,
						role: req.user.role,
						position: req.user.position,
						permissions,
						isAdmin
					},
					tenant: {
						name: req.tenant.name,
						slug: req.tenant.slug,
						businessType,
						planTier,
						maxEmployeesAllowed,
						extraEmployeesPurchased: req.tenant.extraEmployeesPurchased || 0
					},
					capabilities: effectiveCapabilities,
					forms: {
						product: formConfig
					},
					views: {
						productList: productListViewConfig
					},
					store: {
						name: storeConfig?.name || req.tenant.name,
						logo: storeConfig?.logo || req.tenant.settings?.logo,
						posConfig: storeConfig?.posConfig || {}
					}
				}
			});
		} catch (error) {
			next(error);
		}
	}
}
