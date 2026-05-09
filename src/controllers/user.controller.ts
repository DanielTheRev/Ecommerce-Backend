import { AuthRequest } from '@/middleware/auth';
import { UserService } from '@/services/user.service';
import { NextFunction, Response } from 'express';

export class UserController {
	// GET /api/users/clients - Obtener todos los clientes registrados (admin)
	static async getAllClients(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;
			const q = req.query.q as string | undefined;

			const result = await UserService.getAllClients(req.models!, page, limit, q);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}
}
