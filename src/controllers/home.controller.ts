import { HomeService } from '@/services/home.service';
import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';

export class HomeController {
	static async getHomeConfiguration(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const homeConfig = await HomeService.getHomeConfig(req.models!);
			return res.status(200).json(homeConfig);
		} catch (error) {
			return next(error);
		}
	}
}
