import { ShippingMethodService } from '@/services/shippingMethod.service';
import { NextFunction, Request, Response } from 'express';

export class ShippingController {
	// Obtener todas las opciones de envío
	static async getAllShippingOptions(req: Request, res: Response, next: NextFunction) {
		try {
			const shippingOptions = await ShippingMethodService.getShippingOptionsBy({ isActive: true });
			return res.json(shippingOptions);
		} catch (error) {
			return next(error);
		}
	}

	static async getAdminShippingOptions(req: Request, res: Response, next: NextFunction) {
		try {
			const shippingOptions = await ShippingMethodService.getShippingMethods();
			return res.json(shippingOptions);
		} catch (error) {
			return next(error);
		}
	}

	static async getShippingOptionById(req: Request, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const shippingOption = await ShippingMethodService.getShippingMethodBy({ _id: id });
			if (!shippingOption) {

				throw new Error('Opción de envío no encontrada');
			}
			return res.json(shippingOption);
		} catch (error) {
			return next(error);
		}
	}

	// Obtener opciones de envío por método de pago
	// static async getShippingOptionsByPaymentMethod(req: Request, res: Response, next: NextFunction) {
	// 	try {
	// 		const { paymentMethod } = req.query;

	// 		let shippingQuery: any = {};

	// 		if (paymentMethod === PaymentType.CASH) {
	// 			shippingQuery.type = ShippingType.PICKUP;
	// 			shippingQuery.isDefaultForCash = true;
	// 		}

	// 		const shippingOptions = await ShippingMethodService.getShippingOptionsBy(shippingQuery);

	// 		return res.json({
	// 			success: true,
	// 			data: shippingOptions
	// 		});
	// 	} catch (error) {
	// 		return next(error);
	// 	}
	// }

	// Crear nueva opción de envío (solo admin)
	static async createShippingOption(req: Request, res: Response, next: NextFunction) {
		try {
			const shippingOption = await ShippingMethodService.createShippingOption(req.body);

			return res.status(201).json(shippingOption);
		} catch (error) {
			return next(error);
		}
	}

	// Actualizar opción de envío (solo admin)
	static async updateShippingOption(req: Request, res: Response, next: NextFunction) {

		try {
			const { id } = req.params;
			const shippingOption = await ShippingMethodService.updateShippingOption(id, req.body);

			return res.json(shippingOption);
		} catch (error) {
			return next(error);
		}
	}

	// Eliminar opción de envío (solo admin)
	static async deleteShippingOption(req: Request, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			await ShippingMethodService.deleteShippingOption(id);

			return res.json({
				success: true,
				id
			});
		} catch (error) {
			return next(error);
		}
	}
}
