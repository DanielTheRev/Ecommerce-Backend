import { Request, Response } from 'express';
import { PaymentMethod } from '@/models/PaymentMethod.model';

export class PaymentMethodController {
	// Obtener todos los métodos de pago
	static async getAllPaymentMethods(req: Request, res: Response) {
		try {
			const paymentMethods = await PaymentMethod.find();
			return res.json({
				success: true,
				data: paymentMethods
			});
		} catch (error) {
			return res.status(500).json({
				success: false,
				message: 'Error al obtener los métodos de pago',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Obtener métodos de pago activos
	static async getActivePaymentMethods(req: Request, res: Response) {
		try {
			const paymentMethods = await PaymentMethod.find({ isActive: true });
			return res.json({
				success: true,
				data: paymentMethods
			});
		} catch (error) {
			return res.status(500).json({
				success: false,
				message: 'Error al obtener los métodos de pago activos',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Obtener método de pago por ID
	static async getPaymentMethodById(req: Request, res: Response) {
		try {
			const { id } = req.params;
			const paymentMethod = await PaymentMethod.findById(id);

			if (!paymentMethod) {
				return res.status(404).json({
					success: false,
					message: 'Método de pago no encontrado'
				});
			}

			return res.json({
				success: true,
				data: paymentMethod
			});
		} catch (error) {
			return res.status(500).json({
				success: false,
				message: 'Error al obtener el método de pago',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Crear nuevo método de pago (solo admin)
	static async createPaymentMethod(req: Request, res: Response) {
		try {
			const paymentMethod = new PaymentMethod(req.body);
			await paymentMethod.save();

			return res.status(201).json({
				success: true,
				data: paymentMethod,
				message: 'Método de pago creado exitosamente'
			});
		} catch (error) {
			return res.status(400).json({
				success: false,
				message: 'Error al crear el método de pago',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Actualizar método de pago (solo admin)
	static async updatePaymentMethod(req: Request, res: Response) {
		if (req.params.id === undefined || req.body === undefined) {
			return res.status(400).json({
				success: false,
				message: 'Error al actualizar el método de pago',
				error: 'No hay id o no hay body'
			});
		}

		try {
			const { id } = req.params;
			const paymentMethod = await PaymentMethod.findByIdAndUpdate(id, req.body, {
				new: true,
				runValidators: true
			});

			if (!paymentMethod) {
				return res.status(404).json({
					success: false,
					message: 'Método de pago no encontrado'
				});
			}

			return res.json({
				success: true,
				data: paymentMethod,
				message: 'Método de pago actualizado exitosamente'
			});
		} catch (error) {
			return res.status(400).json({
				success: false,
				message: 'Error al actualizar el método de pago',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Eliminar método de pago (solo admin)
	static async deletePaymentMethod(req: Request, res: Response) {
		if (req.params.id === undefined) {
			return res.status(400).json({
				success: false,
				message: 'Error al eliminar el método de pago',
				error: 'No hay id para eliminar'
			});
		}

		try {
			const { id } = req.params;
			const paymentMethod = await PaymentMethod.findByIdAndDelete(id);

			if (!paymentMethod) {
				return res.status(404).json({
					success: false,
					message: 'Método de pago no encontrado'
				});
			}

			return res.json({
				success: true,
				message: 'Método de pago eliminado exitosamente'
			});
		} catch (error) {
			return res.status(500).json({
				success: false,
				message: 'Error al eliminar el método de pago',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Activar/Desactivar método de pago (solo admin)
	static async togglePaymentMethodStatus(req: Request, res: Response) {
		if (req.params.id === undefined) {
			return res.status(400).json({
				success: false,
				message: 'Error al cambiar el estado del método de pago',
				error: 'No hay id'
			});
		}

		try {
			const { id } = req.params;
			const paymentMethod = await PaymentMethod.findById(id);

			if (!paymentMethod) {
				return res.status(404).json({
					success: false,
					message: 'Método de pago no encontrado'
				});
			}

			paymentMethod.isActive = !paymentMethod.isActive;
			await paymentMethod.save();

			return res.json({
				success: true,
				data: paymentMethod,
				message: `Método de pago ${
					paymentMethod.isActive ? 'activado' : 'desactivado'
				} exitosamente`
			});
		} catch (error) {
			return res.status(500).json({
				success: false,
				message: 'Error al cambiar el estado del método de pago',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}
}
