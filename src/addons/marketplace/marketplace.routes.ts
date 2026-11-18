import { Router, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AuthRequest, protect, adminOnly, staffOnly } from '@/middleware/auth';
import { AppError } from '@/errors/app.error';
import { MarketplaceService } from '@/services/marketplace.service';

const router: Router = Router();

router.use(protect);

const formatZod = (err: ZodError): AppError =>
	new AppError(
		'Validation Error',
		err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(' | '),
		400
	);

/**
 * GET /api/addons/marketplace
 * Tienda Vexx unificada: { summary, storefront, addons[], templates[], requests[] }
 */
router.get('/', staffOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!req.tenant || !req.models) {
			throw new AppError('Tenant not resolved', 'No se pudo identificar el comercio.', 400);
		}
		const installations = await req.models.AddonInstallation.find().lean();
		const installedMap: Record<string, { isConfigured?: boolean; settings?: Record<string, unknown> }> = {};
		for (const inst of installations) {
			installedMap[inst.addonId] = { isConfigured: inst.isConfigured, settings: inst.settings };
		}
		const data = await MarketplaceService.getMarketplaceForTenant(req.tenant, installedMap);
		res.status(200).json({ success: true, data });
	} catch (error) {
		next(error);
	}
});

/**
 * GET /api/addons/marketplace/requests
 * Historial de solicitudes de compra del comercio.
 */
router.get('/requests', staffOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!req.tenant) throw new AppError('Tenant not resolved', 'No se pudo identificar el comercio.', 400);
		const data = await MarketplaceService.listRequestsForTenant(req.tenant);
		res.status(200).json({ success: true, count: data.length, data });
	} catch (error) {
		next(error);
	}
});

/**
 * POST /api/addons/marketplace/purchase
 * Body: { kind: 'addon' | 'template', itemId: string }
 * - Incluido en el plan -> activación directa (status 'approved').
 * - Comprable -> solicitud 'pending' que aprueba el SuperAdmin en console.vexx.
 */
router.post('/purchase', adminOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		if (!req.tenant) throw new AppError('Tenant not resolved', 'No se pudo identificar el comercio.', 400);
		const request = await MarketplaceService.createRequest(req.tenant, req.body);
		res.status(request.status === 'approved' ? 200 : 202).json({
			success: true,
			message:
				request.status === 'approved'
					? `'${request.itemName}' quedó activado en tu comercio.`
					: `Solicitud de '${request.itemName}' enviada. Te avisamos cuando esté habilitado.`,
			data: request
		});
	} catch (error) {
		next(error instanceof ZodError ? formatZod(error) : error);
	}
});

export default router;
