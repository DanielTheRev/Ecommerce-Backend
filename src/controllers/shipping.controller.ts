import { ShippingMethodService } from '@/services/shippingMethod.service';
import { EcommerceService } from '@/services/ecommerce.service';
import { calculateDynamicShippingCost } from '@/utils/provinces';
import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';

export class ShippingController {
	/**
	 * POST /api/shipping/calculate
	 * Cotizador dinámico para Vex / Carrito según provincia, ítems y subsidio acumulado
	 */
	static async calculateShipping(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { state, zipCode, items, subtotal: manualSubtotal } = req.body;
			const config = await EcommerceService.getConfig(req.models!);

			let subtotal = Number(manualSubtotal) || 0;
			let itemCount = 0;
			let accumulatedSubsidy = 0;

			if (Array.isArray(items) && items.length > 0) {
				const productIds = items.map((i: any) => i.productId || i._id).filter(Boolean);
				const products = await req.models!.Product.find({ _id: { $in: productIds } }).select('price');

				for (const item of items) {
					const pid = (item.productId || item._id)?.toString();
					const qty = Number(item.quantity) || 1;
					itemCount += qty;

					const prod = products.find((p: any) => p._id.toString() === pid);
					if (prod) {
						if (!manualSubtotal) {
							subtotal += (prod.price?.cashTransferPrice || prod.price?.listPrice || 0) * qty;
						}
						const subsidy = (prod.price as any)?.shippingSubsidy ?? config.shippingConfig?.defaultItemSubsidy ?? 4000;
						accumulatedSubsidy += subsidy * qty;
					} else {
						accumulatedSubsidy += (config.shippingConfig?.defaultItemSubsidy ?? 4000) * qty;
					}
				}
			} else {
				itemCount = 1;
				accumulatedSubsidy = config.shippingConfig?.defaultItemSubsidy ?? 4000;
			}

			const calc = calculateDynamicShippingCost({
				subtotal,
				itemCount,
				accumulatedSubsidy,
				stateOrProvince: state || '',
				zipCode,
				shippingConfig: config.shippingConfig
			});

			return res.json({
				success: true,
				...calc
			});
		} catch (error) {
			return next(error);
		}
	}

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
