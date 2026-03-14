import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { EcommerceService } from '@/services/ecommerce.service';
import { MercadoPagoService } from '@/services/mercadopago.service';

export class EcommerceConfigController {

	// GET /api/Ecommerce/config/mercadopago-methods - Obtener métodos de MP disponibles
	static async getMercadoPagoMethods(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const config = await EcommerceService.getConfig(req.models!);
			const accessToken = config.paymentGateways.mercadopago.accessToken;

			if (!accessToken || accessToken === 'no asignado') {
				res.status(200).json([]);
				return;
			}

			const methods = await MercadoPagoService.getAvailableMethods(accessToken);
			res.status(200).json(methods);
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/Ecommerce/config/payment-gateway - Actualizar gateway
	// static async updatePaymentGateway(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
	// 	try {
	// 		const data = req.body;
	// 		const userId = req.user ? (req.user._id as string).toString() : undefined;

	// 		const updatedConfig = await EcommerceService.updateConfig(req.models!, data, userId);

	// 		res.status(200).json({
	// 			success: true,
	// 			message: 'Configuración actualizada exitosamente',
	// 			data: updatedConfig
	// 		});
	// 	} catch (error) {
	// 		next(error);
	// 	}
	// }


	// GET /api/Ecommerce/config - Obtener la configuración global
	static async getConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const configObj = await EcommerceService.getConfig(req.models!);
			res.status(200).json(configObj);
		} catch (error) {
			next(error);
		}
	}

	// POST /api/Ecommerce/config - Crear configuración (Solo si no existe)
	static async createConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const data = req.body;
			const userId = req.user ? (req.user._id as string).toString() : undefined;

			const newConfig = await EcommerceService.createConfig(req.models!, data, userId);

			res.status(201).json({
				success: true,
				message: 'Configuración creada exitosamente',
				data: newConfig
			});
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/Ecommerce/config - Actualizar configuración
	static async updateConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const data = req.body;
			const userId = req.user ? (req.user._id as string).toString() : undefined;

			const updatedConfig = await EcommerceService.updateConfig(req.models!, data, userId);

			res.status(200).json({
				success: true,
				message: 'Configuración actualizada exitosamente',
				data: updatedConfig
			});
		} catch (error) {
			next(error);
		}
	}

	// DELETE /api/Ecommerce/config - Resetear/Eliminar configuración
	static async deleteConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			await EcommerceService.deleteConfig(req.models!);
			res.status(200).json({
				success: true,
				message: 'Configuración eliminada/reseteada exitosamente'
			});
		} catch (error) {
			next(error);
		}
	}
}
