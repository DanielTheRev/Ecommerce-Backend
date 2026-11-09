import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { RoleProfileService } from '@/services/roleProfile.service';
import { AppError } from '@/errors/app.error';

export class RoleProfileController {
	static async getProfiles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.models) throw new AppError('Tenant not resolved', 'Error interno: modelos no resueltos', 500);

			const profiles = await RoleProfileService.getProfiles(req.models);
			res.status(200).json({
				success: true,
				data: profiles
			});
		} catch (error) {
			next(error);
		}
	}

	static async createProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.models) throw new AppError('Tenant not resolved', 'Error interno: modelos no resueltos', 500);

			const { name, description, permissions } = req.body;
			const created = await RoleProfileService.createProfile(req.models, {
				name,
				description,
				permissions
			});

			res.status(201).json({
				success: true,
				message: 'Perfil de permisos creado correctamente',
				data: created
			});
		} catch (error) {
			next(error);
		}
	}

	static async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.models) throw new AppError('Tenant not resolved', 'Error interno: modelos no resueltos', 500);

			const { id } = req.params;
			const { name, description, permissions } = req.body;
			const updated = await RoleProfileService.updateProfile(req.models, id, {
				name,
				description,
				permissions
			});

			res.status(200).json({
				success: true,
				message: 'Perfil de permisos actualizado correctamente',
				data: updated
			});
		} catch (error) {
			next(error);
		}
	}

	static async deleteProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.models) throw new AppError('Tenant not resolved', 'Error interno: modelos no resueltos', 500);

			const { id } = req.params;
			const result = await RoleProfileService.deleteProfile(req.models, id);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}
}
