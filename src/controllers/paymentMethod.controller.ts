import { PaymentMethodService } from '@/services/paymentMethod.service';
import { NextFunction, Request, Response } from 'express';

export class PaymentMethodController {
	// Obtener todos los métodos de pago
	static async getAllPaymentMethods(req: Request, res: Response, next: NextFunction) {
		try {
			const paymentMethods = await PaymentMethodService.getPaymentMethods();
			return res.json(paymentMethods);
		} catch (error) {
			return next(error)
		}
	}

	// Obtener métodos de pago activos
	static async getActivePaymentMethods(req: Request, res: Response, next: NextFunction) {
		try {
			const paymentMethods = await PaymentMethodService.getPaymentMethodsBy({ isActive: true });
			return res.json(paymentMethods);
		} catch (error) {
			return next(error)
		}
	}

	// Obtener método de pago por ID
	static async getPaymentMethodById(req: Request, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const paymentMethod = await PaymentMethodService.getPaymentMethodById(id);
			return res.json(paymentMethod);
		} catch (error) {
			return next(error)
		}
	}

	// Crear nuevo método de pago (solo admin)
	static async createPaymentMethod(req: Request, res: Response, next: NextFunction) {
		try {
			const data = req.body;
			const paymentMethod = await PaymentMethodService.create(data);

			return res.status(201).json(paymentMethod);
		} catch (error) {
			return next(error)
		}
	}

	// Actualizar método de pago (solo admin)
	static async updatePaymentMethod(req: Request, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const data = req.body;
			const paymentMethod = await PaymentMethodService.update(id, data);

			return res.json(paymentMethod);
		} catch (error) {
			return next(error)
		}
	}

	// Eliminar método de pago (solo admin)
	static async deletePaymentMethod(req: Request, res: Response, next: NextFunction) {

		try {
			const { id } = req.params;
			await PaymentMethodService.delete(id);

			return res.json({
				success: true,
				id
			});
		} catch (error) {
			return next(error)
		}
	}

}

