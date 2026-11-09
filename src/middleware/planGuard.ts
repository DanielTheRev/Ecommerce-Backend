import { Response, NextFunction } from 'express';
import { TenantRequest } from '@/middleware/tenant';
import { PlanCapabilities, VexxPlanTier } from '@/interfaces/plan.interface';
import { getEffectivePlanCapabilities } from '@/config/planCapabilities';
import { AppError } from '@/errors/app.error';
import { ITenant } from '@/interfaces/tenant.interface';

/**
 * Validador estricto de suscripción y rubro para un tenant.
 * - Rechaza de inmediato con 403 si el comercio no tiene planTier o tiene un esquema legacy ('premium', etc.).
 * - Rechaza con 400 si no tiene businessType configurado.
 * - Cero fallbacks silenciosos.
 */
export const validateTenantSubscriptionIntegrity = (tenant?: ITenant): void => {
	if (!tenant) {
		throw new AppError('Tenant not found', 'No se ha podido resolver la tienda para la solicitud.', 404);
	}

	if (tenant.isActive === false) {
		throw new AppError('Tenant deactivated', `La tienda '${tenant.slug}' se encuentra desactivada.`, 403);
	}

	if (!tenant.planTier) {
		const legacyPlan = (tenant as any).plan || 'desconocido';
		throw new AppError(
			'Legacy plan detected',
			`Acceso denegado: El comercio '${tenant.slug}' posee un esquema de suscripción legacy o desactualizado ('${legacyPlan}'). Requiere configurar planTier ('local' | 'point' | 'pro') en la base central antes de permitir el acceso.`,
			403
		);
	}

	const normalizedTier = tenant.planTier.trim().toLowerCase() as VexxPlanTier;
	if (!Object.values(VexxPlanTier).includes(normalizedTier)) {
		throw new AppError(
			'Invalid plan tier',
			`Acceso denegado: El plan '${tenant.planTier}' del comercio '${tenant.slug}' no es válido. Planes soportados: ${Object.values(VexxPlanTier).join(', ')}.`,
			403
		);
	}

	if (!tenant.businessType || !tenant.businessType.trim()) {
		throw new AppError(
			'Business type not configured',
			`Acceso denegado: El comercio '${tenant.slug}' no tiene un rubro comercial asignado en su configuración.`,
			400
		);
	}
};

/**
 * Middleware guardián de capacidades de plan.
 * Verifica que el comercio autenticado tenga contratado un plan que incluya
 * la capacidad requerida (hasMarketingBanners, hasCoupons, hasShopTheLook, etc.).
 * Si el comercio no tiene planTier o la capacidad es false, rechaza con HTTP 403 explícito.
 */
export const requirePlanCapability = (
	capability: keyof PlanCapabilities,
	featureLabel?: string
) => {
	return (req: TenantRequest, res: Response, next: NextFunction): void => {
		validateTenantSubscriptionIntegrity(req.tenant);

		const planCaps = getEffectivePlanCapabilities(req.tenant!.planTier, req.tenant!.businessType);
		if (!planCaps[capability]) {
			const label = featureLabel || String(capability);
			const planName = req.tenant!.planTier!.toUpperCase();
			throw new AppError(
				'Plan capability forbidden',
				`Tu suscripción o rubro actual ('${planName}') no incluye la función '${label}'.`,
				403
			);
		}

		next();
	};
};
