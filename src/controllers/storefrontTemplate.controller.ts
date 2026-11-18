import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '@/errors/app.error';
import { StorefrontTemplateService } from '@/services/storefrontTemplate.service';
import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection } from '@/config/modelRegistry';
import { EcommerceService } from '@/services/ecommerce.service';
import { ITenant } from '@/interfaces/tenant.interface';

export class StorefrontTemplateController {
	private static formatZodError(err: ZodError): AppError {
		const details = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(' | ');
		return new AppError('Validation Error', `Datos inválidos en plantilla: ${details}`, 400);
	}

	/**
	 * GET /api/master/storefront-templates
	 * Lista el catálogo maestro de plantillas con conteo de comercios activos que usan cada una.
	 */
	static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const includeInactive = req.query.activeOnly !== 'true';
			const templates = await StorefrontTemplateService.listAllTemplates(includeInactive);

			const masterDb = connectionManager.getMasterDb();
			const TenantModel = masterDb.model<ITenant>('Tenant');
			const usageAgg = await TenantModel.aggregate<{ _id: string; count: number }>([
				{ $match: { isActive: true, activeTemplateKey: { $type: 'string', $ne: '' } } },
				{ $group: { _id: '$activeTemplateKey', count: { $sum: 1 } } }
			]);
			const usageMap = new Map<string, number>(usageAgg.map((r) => [r._id, r.count]));

			const enriched = templates.map((t) => ({
				...t,
				activeTenantsCount: usageMap.get(t.key) || 0
			}));

			res.status(200).json({
				success: true,
				count: enriched.length,
				data: enriched
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/master/storefront-templates/:key
	 */
	static async getByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const template = await StorefrontTemplateService.getTemplateByKey(req.params.key);
			res.status(200).json({
				success: true,
				data: template
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/master/storefront-templates
	 */
	static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const created = await StorefrontTemplateService.createTemplate(req.body);
			res.status(201).json({
				success: true,
				message: `Plantilla '${created.name}' (${created.key}) creada en master_db.`,
				data: created
			});
		} catch (error) {
			if (error instanceof ZodError) {
				next(this.formatZodError(error));
				return;
			}
			next(error);
		}
	}

	/**
	 * PUT /api/master/storefront-templates/:key
	 */
	static async updateByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const updated = await StorefrontTemplateService.updateTemplate(req.params.key, req.body);
			res.status(200).json({
				success: true,
				message: `Plantilla '${updated.name}' (${updated.key}) actualizada.`,
				data: updated
			});
		} catch (error) {
			if (error instanceof ZodError) {
				next(this.formatZodError(error));
				return;
			}
			next(error);
		}
	}

	/**
	 * DELETE /api/master/storefront-templates/:key
	 */
	static async deleteByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const result = await StorefrontTemplateService.deleteTemplate(req.params.key);
			res.status(200).json({
				success: true,
				message: `Plantilla '${result.deletedKey}' eliminada correctamente.`,
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/master/tenants/:id/storefront
	 * Permite al SuperAdmin desde console.vexx configurar plantilla activa, plantillas desbloqueadas
	 * y dominio (subdominio gratuito *.vexx.com.ar o dominio propio) de un comercio.
	 */
	static async updateTenantStorefront(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const result = await StorefrontTemplateService.updateTenantStorefrontBySuperAdmin(id, req.body);
			res.status(200).json({
				success: true,
				message: 'Configuración de plantilla y dominio del comercio actualizada.',
				data: result
			});
		} catch (error) {
			if (error instanceof ZodError) {
				next(this.formatZodError(error));
				return;
			}
			next(error);
		}
	}

	/**
	 * GET /api/storefront/resolve-host?hostname=mikioko.vexx.com.ar
	 * Endpoint público sin requerir x-api-key previo para que Vura-StoreFront (Astro) o e-commerce (Angular)
	 * descubra el comercio, su plantilla activa y su configuración pública a partir del dominio o subdominio visitado.
	 */
	static async resolveHostPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const queryHost = (req.query.hostname || req.query.host || req.headers['x-storefront-host']) as string | undefined;
			const querySlug = req.query.slug as string | undefined;

			let tenant: ITenant | null = null;
			if (queryHost && typeof queryHost === 'string' && queryHost.trim()) {
				tenant = await connectionManager.getTenantByDomain(queryHost.trim());
			} else if (querySlug && typeof querySlug === 'string' && querySlug.trim()) {
				tenant = await connectionManager.getTenantBySlug(querySlug.trim());
			} else if (req.hostname && req.hostname !== 'localhost' && req.hostname !== '127.0.0.1') {
				tenant = await connectionManager.getTenantByDomain(req.hostname);
			}

			if (!tenant) {
				throw new AppError(
					'Storefront not found',
					`No se encontró una tienda activa vinculada al dominio o identificador '${queryHost || querySlug || req.hostname}'.`,
					404
				);
			}

			if (!tenant.isActive || tenant.subscriptionStatus === 'suspended') {
				throw new AppError(
					'Storefront unavailable',
					'Esta tienda se encuentra temporalmente fuera de línea.',
					403
				);
			}

			const tenantDb = connectionManager.getTenantDb(tenant.dbName);
			const models = getModelsForConnection(tenantDb);

			const [storefront, publicConfig] = await Promise.all([
				StorefrontTemplateService.buildTenantStorefrontSummary(tenant),
				EcommerceService.getPublicConfig(models, tenant.slug, tenant)
			]);

			res.status(200).json({
				success: true,
				data: {
					tenant: {
						slug: tenant.slug,
						name: tenant.name,
						businessType: tenant.businessType,
						planTier: tenant.planTier,
						apiKey: tenant.apiKey
					},
					storefront,
					publicConfig
				}
			});
		} catch (error) {
			next(error);
		}
	}
}
