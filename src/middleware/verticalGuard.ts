import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { isFeatureAllowed, VerticalCapabilities } from '@/config/verticalCapabilities';
import { EcommerceService } from '@/services/ecommerce.service';
import { AppError } from '@/errors/app.error';

/**
 * Middleware para exigir que el comercio tenga habilitada una funcionalidad específica
 * según su rubro / businessType.
 * Si el comercio no la tiene habilitada, rechaza la petición con HTTP 403 Forbidden.
 */
export const requireFeature = (
	feature: keyof Omit<VerticalCapabilities, 'businessType' | 'label' | 'allowedProductTypes'>,
	featureLabel?: string
) => {
	return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
		try {
			if (!req.models) {
				throw new AppError('Database not initialized', 'Base de datos del comercio no inicializada', 500);
			}

			const config = await EcommerceService.getConfig(req.models);
			const businessType = req.tenant?.businessType || config?.businessType;
			if (!businessType) {
				throw new AppError(
					'Business type not configured',
					'Error de integridad: El comercio no tiene un rubro comercial asignado en su configuración.',
					400
				);
			}

			if (!isFeatureAllowed(businessType, feature)) {
				const label = featureLabel || feature;
				throw new AppError(
					'Feature not allowed',
					`La funcionalidad '${label}' no está disponible para el rubro comercial '${businessType}'.`,
					403
				);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
};
