import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { AppError } from '@/errors/app.error';
import { TenantBootstrapService } from '@/services/tenantBootstrap.service';

export class TenantBootstrapController {
	/**
	 * GET /api/tenant/bootstrap
	 * Endpoint de arranque universal para Frontend (Angular) y Android.
	 * Devuelve todo lo que la aplicación necesita para inicializarse en una sola llamada:
	 * Perfil del usuario autenticado, permisos asignados, capacidades del plan,
	 * capacidades del rubro y configuración de formularios (@if).
	 * Accesible tanto para Administrador como para Empleados.
	 */
	static async getBootstrapData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.user) {
				throw new AppError('Unauthorized', 'Usuario no autenticado', 401);
			}
			if (!req.tenant || !req.models) {
				throw new AppError('Tenant not resolved', 'Error crítico: no se pudo resolver el comercio.', 500);
			}

			const data = await TenantBootstrapService.buildBootstrapPayload(req.models, req.tenant, req.user);

			res.status(200).json({
				success: true,
				data
			});
		} catch (error) {
			next(error);
		}
	}
}
