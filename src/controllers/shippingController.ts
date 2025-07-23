import { Request, Response } from 'express';
import { ShippingOption, ShippingType } from '../models/ShippingOption';

export class ShippingController {
	// Obtener todas las opciones de envío
	static async getAllShippingOptions(req: Request, res: Response) {
		try {
			const shippingOptions = await ShippingOption.find();
			res.json({
				success: true,
				data: shippingOptions
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: 'Error al obtener las opciones de envío',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Obtener opciones de envío por método de pago
	static async getShippingOptionsByPaymentMethod(req: Request, res: Response) {
		try {
			const { paymentMethod } = req.query;

			let shippingOptions;

			if (paymentMethod === 'cash') {
				// Solo puntos de venta para pago en efectivo
				shippingOptions = await ShippingOption.find({
					type: ShippingType.PICKUP,
					isDefaultForCash: true
				});
			} else {
				// Todas las opciones para otros métodos de pago
				shippingOptions = await ShippingOption.find();
			}

			res.json({
				success: true,
				data: shippingOptions
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: 'Error al obtener las opciones de envío',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Crear nueva opción de envío (solo admin)
	static async createShippingOption(req: Request, res: Response) {
		try {
			const shippingOption = new ShippingOption(req.body);
			await shippingOption.save();

			res.status(201).json({
				success: true,
				data: shippingOption,
				message: 'Opción de envío creada exitosamente'
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: 'Error al crear la opción de envío',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Actualizar opción de envío (solo admin)
	static async updateShippingOption(req: Request, res: Response) {
		if (req.params.id === undefined || req.body === undefined) {
			res.status(500).json({
				success: false,
				message: 'Error al actualizar la opción de envío',
				error: 'No hay id o no hay body'
			});
		}
		try {
			const { id } = req.params;
			const shippingOption = await ShippingOption.findByIdAndUpdate(id, req.body, {
				new: true,
				runValidators: true
			});

			if (!shippingOption) {
				return res.status(404).json({
					success: false,
					message: 'Opción de envío no encontrada'
				});
			}

			return res.json({
				success: true,
				data: shippingOption,
				message: 'Opción de envío actualizada exitosamente'
			});
		} catch (error) {
			return res.status(400).json({
				success: false,
				message: 'Error al actualizar la opción de envío',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// Eliminar opción de envío (solo admin)
	static async deleteShippingOption(req: Request, res: Response) {
		if (req.params.id === undefined) {
			return res.status(500).json({
				success: false,
				message: 'Error al eliminar la opción de envío',
				error: 'No hay id al cual actualizar'
			});
		}
		try {
			const { id } = req.params;
			const shippingOption = await ShippingOption.findByIdAndDelete(id);

			if (!shippingOption) {
				return res.status(404).json({
					success: false,
					message: 'Opción de envío no encontrada'
				});
			}

			return res.json({
				success: true,
				message: 'Opción de envío eliminada exitosamente'
			});
		} catch (error) {
			return res.status(500).json({
				success: false,
				message: 'Error al eliminar la opción de envío',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}
}
