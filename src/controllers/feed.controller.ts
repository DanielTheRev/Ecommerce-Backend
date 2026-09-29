import { Response, NextFunction } from 'express';
import { TenantRequest } from '@/middleware/tenant';
import { FeedService } from '@/services/feed.service';
import { AppError } from '@/errors/app.error';

export class FeedController {
	private constructor() {}

	/**
	 * GET /api/feeds/meta
	 * GET /api/feeds/meta/:tenantSlug
	 * Query params: ?format=xml | ?format=csv
	 */
	public static async getMetaFeed(req: TenantRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.models) {
				throw new AppError('Tenant models not resolved', 'No se pudieron inicializar los modelos del comercio.', 500);
			}

			// Detectar formato solicitado (por query o por terminación de URL)
			let format: 'xml' | 'csv' = 'xml';
			const queryFormat = req.query.format as string;
			if (queryFormat === 'csv' || req.originalUrl.endsWith('.csv')) {
				format = 'csv';
			}

			const result = await FeedService.generateMetaFeed(req.models, req.tenant, format);

			res.setHeader('Content-Type', result.contentType);
			res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
			res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);

			res.status(200).send(result.content);
		} catch (error) {
			next(error);
		}
	}
}
