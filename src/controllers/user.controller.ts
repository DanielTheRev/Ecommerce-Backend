import { AuthRequest } from '@/middleware/auth';
import { UserService } from '@/services/user.service';
import { NextFunction, Response } from 'express';

export class UserController {
	// GET /api/users/me - Obtener perfil del usuario autenticado
	static async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user?._id;
			if (!userId) {
				res.status(401).json({ message: 'No autenticado' });
				return;
			}

			const user = await UserService.getUserByID(req.models!, String(userId));
			res.status(200).json(user);
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/users/me - Actualizar perfil (nombre, apellido, DNI, teléfono)
	static async updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user?._id;
			if (!userId) {
				res.status(401).json({ message: 'No autenticado' });
				return;
			}

			const { name, lastName, dni, phone } = req.body;
			const updatedUser = await UserService.updateUserProfile(req.models!, String(userId), {
				name,
				lastName,
				dni,
				phone
			});

			res.status(200).json(updatedUser);
		} catch (error) {
			next(error);
		}
	}

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
