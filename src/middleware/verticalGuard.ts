import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { isFeatureAllowed, VerticalCapabilities } from '@/config/verticalCapabilities';
import { EcommerceService } from '@/services/ecommerce.service';

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
				res.status(400).json({ success: false, message: 'Base de datos del comercio no inicializada' });
				return;
			}

			const config = await EcommerceService.getConfig(req.models);
			const businessType = config.businessType || req.tenant?.businessType;
			if (!businessType) {
				res.status(500).json({
					success: false,
					message: 'Error de integridad: El comercio no tiene un rubro comercial asignado en su configuración.'
				});
				return;
			}

			if (!isFeatureAllowed(businessType, feature)) {
				const label = featureLabel || feature;
				res.status(403).json({
					success: false,
					message: `La funcionalidad '${label}' no está disponible para el rubro comercial '${businessType}'.`
				});
				return;
			}

			next();
		} catch (error) {
			next(error);
		}
	};
};
