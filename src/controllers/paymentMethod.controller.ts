import { PaymentMethodService } from '@/services/paymentMethod.service';
import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';

export class PaymentMethodController {
	// Obtener todos los métodos de pago (Agregado para el Panel de Control)
	static async getAllPaymentMethods(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			// 1. Obtener métodos manuales de la base de datos
			const manualMethods = await PaymentMethodService.getPaymentMethods(req.models!);

			// 2. Obtener configuración de ecommerce y métodos de MP
			const { EcommerceService } = await import('@/services/ecommerce.service');
			const { MercadoPagoService } = await import('@/services/mercadopago.service');
			
			const config = await EcommerceService.getConfig(req.models!);
			const mpConfig = config.paymentGateways.mercadopago;

			let availableMPMethods: any[] = [];
			if (mpConfig.accessToken && mpConfig.accessToken !== 'no asignado') {
				try {
					availableMPMethods = await MercadoPagoService.getAvailableMethods(mpConfig.accessToken);
				} catch (error) {
					console.error('Error fetching MP methods for aggregate view:', error);
					// No bloqueamos la respuesta si falla MP
				}
			}

			return res.json({
				manualMethods,
				automaticGateways: {
					mercadopago: {
						active: mpConfig.active,
						availableMethods: availableMPMethods,
						excludedPaymentMethods: mpConfig.excludedPaymentMethods || [],
						excludedPaymentTypes: mpConfig.excludedPaymentTypes || []
					}
				}
			});
		} catch (error) {
			return next(error);
		}
	}

	// Obtener métodos de pago activos (Agregado para el Checkout)
	static async getActivePaymentMethods(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			// 1. Obtener métodos manuales activos de la DB
			const manualMethods = await PaymentMethodService.getPaymentMethodsBy(req.models!, { isActive: true });

			// 2. Obtener configuración de gateways
			const { EcommerceService } = await import('@/services/ecommerce.service');
			const config = await EcommerceService.getConfig(req.models!);
			
			const gateWays = {
				mercadopago: {
					active: config.paymentGateways.mercadopago?.active ?? false,
					publicKey: config.paymentGateways.mercadopago?.active ? config.paymentGateways.mercadopago.publicKey : undefined,
					checkoutMode: config.paymentGateways.mercadopago?.checkoutMode || 'transparent',
					environment: config.paymentGateways.mercadopago?.environment || 'production',
					maxInstallments: config.paymentGateways.mercadopago?.maxInstallments || 12,
					absorbInstallments: config.pricingStrategy?.absorbInstallments ?? true,
					maxInstallmentsToAbsorb: config.pricingStrategy?.maxInstallmentsToAbsorb || 3,
					excludedPaymentMethods: config.paymentGateways.mercadopago?.excludedPaymentMethods || [],
					excludedPaymentTypes: config.paymentGateways.mercadopago?.excludedPaymentTypes || []
				},
				getnet: {
					active: config.paymentGateways.getnet?.active ?? false,
					clientId: config.paymentGateways.getnet?.active ? config.paymentGateways.getnet.clientId : undefined,
					environment: config.paymentGateways.getnet?.environment || 'sandbox',
					checkoutMode: config.paymentGateways.getnet?.checkoutMode || 'redirect',
					maxInstallments: config.paymentGateways.getnet?.maxInstallments || 6
				},
				uala: {
					active: config.paymentGateways.uala?.active ?? false,
					clientId: config.paymentGateways.uala?.active ? config.paymentGateways.uala.credentials?.clientId : undefined,
					userName: config.paymentGateways.uala?.active ? config.paymentGateways.uala.credentials?.userName : undefined
				},
				transfer: {
					active: config.paymentGateways.transfer?.active ?? true,
					alias: config.paymentGateways.transfer?.alias || '',
					cbuCvu: config.paymentGateways.transfer?.cbuCvu || '',
					bankName: config.paymentGateways.transfer?.bankName || '',
					titular: config.paymentGateways.transfer?.titular || ''
				}
			};

			return res.json({
				manualMethods,
				gateWays,
				pricingStrategy: {
					absorbInstallments: config.pricingStrategy?.absorbInstallments ?? true,
					maxInstallmentsToAbsorb: config.pricingStrategy?.maxInstallmentsToAbsorb || 3,
					transferDiscountPercentage: config.pricingStrategy?.transferDiscountPercentage || 0,
					cashDiscountPercentage: config.pricingStrategy?.cashDiscountPercentage || 0
				}
			});
		} catch (error) {
			return next(error);
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
