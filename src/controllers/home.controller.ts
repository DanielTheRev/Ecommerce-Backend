import { HomeService } from '@/services/home.service';
import { NextFunction, Request, Response } from 'express';

export class HomeController {
	static async getHomeConfiguration(req: Request, res: Response, next: NextFunction) {
		try {
			const homeConfig = await HomeService.getHomeConfig();
			return res.status(200).json({
				success: true,
				data: homeConfig
			});
		} catch (error) {
			return next(error);
		}
	}
}
