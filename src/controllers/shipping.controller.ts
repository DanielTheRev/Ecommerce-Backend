import { ShippingMethodService } from '@/services/shippingMethod.service';
import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';

export class ShippingController {
	// Obtener todas las opciones de envío
	static async getAllShippingOptions(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const shippingOptions = await ShippingMethodService.getShippingOptionsBy(req.models!, { isActive: true });
			return res.json(shippingOptions);
		} catch (error) {
			return next(error);
		}
	}

	static async getAdminShippingOptions(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const shippingOptions = await ShippingMethodService.getShippingMethods(req.models!);
			return res.json(shippingOptions);
		} catch (error) {
			return next(error);
		}
	}

	static async getShippingOptionById(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const shippingOption = await ShippingMethodService.getShippingMethodBy(req.models!, { _id: id });
			if (!shippingOption) {

				throw new Error('Opción de envío no encontrada');
			}
			return res.json(shippingOption);
		} catch (error) {
			return next(error);
		}
	}

	// Crear nueva opción de envío (solo admin)
	static async createShippingOption(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const shippingOption = await ShippingMethodService.createShippingOption(req.models!, req.body);

			return res.status(201).json(shippingOption);
		} catch (error) {
			return next(error);
		}
	}

	// Actualizar opción de envío (solo admin)
	static async updateShippingOption(req: AuthRequest, res: Response, next: NextFunction) {

		try {
			const { id } = req.params;
			const shippingOption = await ShippingMethodService.updateShippingOption(req.models!, id, req.body);

			return res.json(shippingOption);
		} catch (error) {
			return next(error);
		}
	}

	// Eliminar opción de envío (solo admin)
	static async deleteShippingOption(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			await ShippingMethodService.deleteShippingOption(req.models!, id);

			return res.json({
				success: true,
				id
			});
		} catch (error) {
			return next(error);
		}
	}
}
