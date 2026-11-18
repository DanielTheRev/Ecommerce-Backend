import { Router, Response, NextFunction } from 'express';
import { AuthRequest, protect, adminOnly, staffOnly } from '@/middleware/auth';
import { AppError } from '@/errors/app.error';
import { StorefrontTemplateService } from '@/services/storefrontTemplate.service';
import { TEMPLATE_DOMAIN_MODES, TenantDomainMode } from '@/interfaces/storefrontTemplate.interface';

const router: Router = Router();

router.use(protect);

/**
 * GET /api/addons/storefront-templates
 * Devuelve el resumen de storefront del comercio (subdominio Vexx, dominio propio, plantilla activa)
 * junto con el catálogo de plantillas disponibles y su estado (isUnlocked, isActive, currentSettings).
 */
router.get('/', staffOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!req.tenant) {
			throw new AppError('Tenant not resolved', 'No se pudo identificar el comercio.', 400);
		}
		const data = await StorefrontTemplateService.getCatalogForTenant(req.tenant);
		res.status(200).json({
			success: true,
			data
		});
	} catch (error) {
		next(error);
	}
});

/**
 * PUT /api/addons/storefront-templates/activate
 * POST /api/addons/storefront-templates/select (alias)
 * Body: { templateKey: string } (acepta también key o id)
 * Activa una plantilla desbloqueada para el comercio.
 */
const handleActivateTemplate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!req.tenant) {
			throw new AppError('Tenant not resolved', 'No se pudo identificar el comercio.', 400);
		}
		const templateKey = String(req.body?.templateKey || req.body?.key || req.body?.id || '').trim();
		if (!templateKey) {
			throw new AppError('Validation Error', 'El campo templateKey es obligatorio.', 400);
		}
		const data = await StorefrontTemplateService.activateTemplateForTenant(req.tenant, templateKey);
		res.status(200).json({
			success: true,
			message: 'Plantilla activada con éxito.',
			data
		});
	} catch (error) {
		next(error);
	}
};

router.put('/activate', adminOnly, handleActivateTemplate);
router.post('/select', adminOnly, handleActivateTemplate);

/**
 * PUT /api/addons/storefront-templates/settings
 * Body: { settings: Record<string, unknown> }
 * Actualiza los parámetros personalizables (customizableFields) de la plantilla activa.
 */
router.put('/settings', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!req.tenant) {
			throw new AppError('Tenant not resolved', 'No se pudo identificar el comercio.', 400);
		}
		const settings = req.body?.settings;
		const storefront = await StorefrontTemplateService.updateTemplateSettingsForTenant(req.tenant, settings);
		res.status(200).json({
			success: true,
			message: 'Configuración visual de la plantilla actualizada.',
			data: { storefront }
		});
	} catch (error) {
		next(error);
	}
});

/**
 * PUT /api/addons/storefront-templates/domain
 * Body: { customDomain?: string | null, domainMode?: 'vexx_subdomain' | 'custom_domain' }
 * Vincula o actualiza el dominio propio del comercio (requiere addon custom_domain activo).
 */
router.put('/domain', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!req.tenant) {
			throw new AppError('Tenant not resolved', 'No se pudo identificar el comercio.', 400);
		}
		const { customDomain, domainMode } = req.body || {};
		if (domainMode !== undefined && !TEMPLATE_DOMAIN_MODES.includes(domainMode as TenantDomainMode)) {
			throw new AppError('Validation Error', `El modo de dominio '${domainMode}' no es válido.`, 400);
		}
		const data = await StorefrontTemplateService.updateCustomDomainForTenant(req.tenant, {
			customDomain,
			domainMode
		});
		res.status(200).json({
			success: true,
			message: 'Configuración de dominio actualizada.',
			data
		});
	} catch (error) {
		next(error);
	}
});

export default router;
