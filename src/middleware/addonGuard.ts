import { Response, NextFunction } from 'express';
import { TenantRequest } from '@/middleware/tenant';
import { validateTenantSubscriptionIntegrity } from '@/middleware/planGuard';
import { getAddonModule, normalizeActiveAddons } from '@/addons/registry';
import { AppError } from '@/errors/app.error';

/**
 * Middleware guardián de complementos.
 * Verifica directamente contra el contrato de add-ons activos del tenant (SuperAdmin manda).
 */
export const requireAddon = (addonId: string, featureLabel?: string) => {
	return (req: TenantRequest, _res: Response, next: NextFunction): void => {
		validateTenantSubscriptionIntegrity(req.tenant);

		const mod = getAddonModule(addonId);
		const normalizedId = mod ? mod.manifest.id : addonId.trim().toLowerCase();
		const activeSet = new Set(normalizeActiveAddons(req.tenant!.activeAddons || []));

		if (!activeSet.has(normalizedId)) {
			const label = featureLabel || mod?.manifest.name || addonId;
			throw new AppError(
				'Addon not active',
				`El módulo '${label}' no se encuentra activo para este comercio.`,
				403
			);
		}

		next();
	};
};
