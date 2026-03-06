import { PaymentMethodService } from '@/services/paymentMethod.service';
import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';

export class PaymentMethodController {
	// Obtener todos los métodos de pago
	static async getAllPaymentMethods(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const paymentMethods = await PaymentMethodService.getPaymentMethods(req.models!);
			return res.json(paymentMethods);
		} catch (error) {
			return next(error)
		}
	}

	// Obtener métodos de pago activos
	static async getActivePaymentMethods(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const paymentMethods = await PaymentMethodService.getPaymentMethodsBy(req.models!, { isActive: true });
			return res.json(paymentMethods);
		} catch (error) {
			return next(error)
		}
	}

	// Obtener método de pago por ID
	static async getPaymentMethodById(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const paymentMethod = await PaymentMethodService.getPaymentMethodById(req.models!, id);
			return res.json(paymentMethod);
		} catch (error) {
			return next(error)
		}
	}

	// Crear nuevo método de pago (solo admin)
	static async createPaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const data = req.body;
			const paymentMethod = await PaymentMethodService.create(req.models!, data);

			return res.status(201).json(paymentMethod);
		} catch (error) {
			return next(error)
		}
	}

	// Actualizar método de pago (solo admin)
	static async updatePaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const data = req.body;
			const paymentMethod = await PaymentMethodService.update(req.models!, id, data);

			return res.json(paymentMethod);
		} catch (error) {
			return next(error)
		}
	}

	// Eliminar método de pago (solo admin)
	static async deletePaymentMethod(req: AuthRequest, res: Response, next: NextFunction) {

		try {
			const { id } = req.params;
			await PaymentMethodService.delete(req.models!, id);

			return res.json({
				success: true,
				id
			});
		} catch (error) {
			return next(error)
		}
	}

}
