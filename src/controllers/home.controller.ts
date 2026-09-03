import { HomeService } from '@/services/home.service';
import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';

export class HomeController {
	static async getHomeConfiguration(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const newsLimit = req.query.newsLimit
				? parseInt(req.query.newsLimit as string, 10)
				: (req.query.limit ? parseInt(req.query.limit as string, 10) : 12);
			const splitColors = req.query.splitColors === 'true';

			const homeConfig = await HomeService.getHomeConfig(req.models!, req.tenant?.slug, {
				newsLimit,
				splitColors
			});
			return res.status(200).json(homeConfig);
		} catch (error) {
			return next(error);
		}
	}
}
