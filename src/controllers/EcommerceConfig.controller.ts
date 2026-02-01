import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { EcommerceService } from '@/services/ecommerce.service';

export class EcommerceConfigController {

	// GET /api/ecommerce/config - Obtener la configuración global
	static async getConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const configObj = await EcommerceService.getConfig();
			res.status(200).json(configObj);
		} catch (error) {
			next(error);
		}
	}

	// POST /api/ecommerce/config - Crear configuración (Solo si no existe)
	static async createConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const data = req.body;
			const userId = req.user ? (req.user._id as string).toString() : undefined;

			const newConfig = await EcommerceService.createConfig(data, userId);

			res.status(201).json({
				success: true,
				message: 'Configuración creada exitosamente',
				data: newConfig
			});
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/ecommerce/config - Actualizar configuración
	static async updateConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const data = req.body;
			const userId = req.user ? (req.user._id as string).toString() : undefined;

			const updatedConfig = await EcommerceService.updateConfig(data, userId);

			res.status(200).json({
				success: true,
				message: 'Configuración actualizada exitosamente',
				data: updatedConfig
			});
		} catch (error) {
			next(error);
		}
	}

	// DELETE /api/ecommerce/config - Resetear/Eliminar configuración
	static async deleteConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			await EcommerceService.deleteConfig();
			res.status(200).json({
				success: true,
				message: 'Configuración eliminada/reseteada exitosamente'
			});
		} catch (error) {
			next(error);
		}
	}
}
