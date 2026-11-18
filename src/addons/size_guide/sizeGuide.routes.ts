import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { AuthRequest, protect, staffOnly } from '@/middleware/auth';
import { requireAddon } from '@/middleware/addonGuard';
import { AppError } from '@/errors/app.error';
import { CacheService } from '@/services/cache.service';
import { ISizeGuideTemplate } from '@/interfaces/ecommerce.interface';

const router: Router = Router();

const sizeGuideTemplateSchema = z.object({
	id: z.string().trim().min(1).max(60).optional(),
	name: z.string().trim().min(1, 'El nombre de la plantilla es obligatorio.').max(80),
	headers: z.array(z.string().trim().min(1)).min(2, 'Se requieren al menos 2 columnas (ej. Medida + 1 valor).'),
	defaultRows: z.array(z.string().trim().min(1)).min(1, 'Se requiere al menos 1 fila.'),
	tolerance: z.string().trim().max(120).optional(),
	isDefault: z.boolean().optional()
});

router.use(protect, requireAddon('size_guide', 'Guía de Talles & Medidas'));

/**
 * GET /api/addons/size-guide/templates
 * Lista las plantillas de Guía de Talles guardadas en el comercio.
 */
router.get('/templates', staffOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		const config = await req.models!.EcommerceConfig.findOne({ key: 'global_config' }).lean();
		const templates = Array.isArray((config as any)?.sizeGuideTemplates) ? (config as any).sizeGuideTemplates : [];
		res.status(200).json({ success: true, data: { templates } });
	} catch (error) {
		next(error);
	}
});

/**
 * POST /api/addons/size-guide/templates
 * Crea o actualiza una plantilla de Guía de Talles para reutilizar columnas y talles en futuros productos.
 */
router.post('/templates', staffOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		const parsed = sizeGuideTemplateSchema.parse(req.body || {});
		const models = req.models!;
		const tenantSlug = req.tenant?.slug;

		const config = await models.EcommerceConfig.findOne({ key: 'global_config' }).lean();
		const existing: ISizeGuideTemplate[] = Array.isArray((config as any)?.sizeGuideTemplates)
			? ([...(config as any).sizeGuideTemplates] as ISizeGuideTemplate[])
			: [];

		const targetId = parsed.id || `sg_${randomUUID().slice(0, 8)}`;
		const nextTemplate: ISizeGuideTemplate = {
			id: targetId,
			name: parsed.name,
			headers: parsed.headers,
			defaultRows: parsed.defaultRows,
			...(parsed.tolerance ? { tolerance: parsed.tolerance } : {}),
			...(parsed.isDefault !== undefined ? { isDefault: parsed.isDefault } : {})
		};

		if (parsed.isDefault) {
			for (const t of existing) {
				t.isDefault = false;
			}
		}

		const existingIdx = existing.findIndex(
			(t) => t.id === targetId || t.name.trim().toLowerCase() === parsed.name.toLowerCase()
		);
		if (existingIdx >= 0) {
			existing[existingIdx] = { ...nextTemplate, id: existing[existingIdx].id };
		} else {
			existing.push(nextTemplate);
		}

		await models.EcommerceConfig.updateOne(
			{ key: 'global_config' },
			{ $set: { sizeGuideTemplates: existing } },
			{ upsert: true }
		);

		if (tenantSlug) {
			CacheService.invalidatePrefix(tenantSlug, 'config');
		}

		res.status(200).json({ success: true, data: { template: nextTemplate, templates: existing } });
	} catch (error) {
		next(error);
	}
});

/**
 * DELETE /api/addons/size-guide/templates/:templateId
 * Elimina una plantilla de Guía de Talles del comercio.
 */
router.delete('/templates/:templateId', staffOnly, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		const templateId = String(req.params.templateId || '').trim();
		if (!templateId) {
			throw new AppError('Validation Error', 'El ID de la plantilla es obligatorio.', 400);
		}
		const models = req.models!;
		const tenantSlug = req.tenant?.slug;

		const config = await models.EcommerceConfig.findOne({ key: 'global_config' }).lean();
		const existing: ISizeGuideTemplate[] = Array.isArray((config as any)?.sizeGuideTemplates)
			? ((config as any).sizeGuideTemplates as ISizeGuideTemplate[])
			: [];
		const filtered = existing.filter((t) => t.id !== templateId);

		await models.EcommerceConfig.updateOne(
			{ key: 'global_config' },
			{ $set: { sizeGuideTemplates: filtered } }
		);

		if (tenantSlug) {
			CacheService.invalidatePrefix(tenantSlug, 'config');
		}

		res.status(200).json({ success: true, data: { templates: filtered } });
	} catch (error) {
		next(error);
	}
});

export default router;
