import { NextFunction, Response } from 'express';
import { Auth0MercadoPago, AuthRequest } from '@/middleware/auth';
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

	static handleMercadoPagoCallback = async (req: Auth0MercadoPago, res: Response) => {
		const { code, state } = req.query;
		console.log('MercadoPago Callback');
		console.log(code);
		console.log(state);

		try {
			// Validamos a nivel HTTP que vengan los datos básicos
			if (!code || typeof code !== 'string') {
				throw new Error('Código de autorización no proporcionado');
			}

			// Delegamos toda la lógica pesada al servicio
			// req.models existe seguro porque pasamos por el middleware resolveTenant
			await EcommerceService.handleMercadoPagoOAuth(req.models!, code);

			// Si todo sale bien, redirigimos al éxito
			// const frontendUrl = process.env.NODE_ENV === 'production'
			// 	? `https://dashboard.${state}.com.ar/settings?mp_success=true`
			// 	: `http://localhost:4200/settings?mp_success=true`;
			const frontendURL = 'https://dashboard.vura.com.ar/home/settings?mp_success=true';

			return res.redirect(frontendURL);

		} catch (error) {
			console.error('Error en el controlador al vincular MP:', error);

			// Si el servicio falla y tira un error, el controlador lo ataja acá 
			// y redirige con la flag de error para que el frontend lo maneje
			// const errorUrl = process.env.NODE_ENV === 'production'
			// 	? `https://dashboard.${state}.com.ar/home/settings?mp_error=true`
			// 	: `http://localhost:4200/home/settings?mp_error=true`;
			const errorUrl = 'https://dashboard.vura.com.ar/home/settings?mp_error=true';

			return res.redirect(errorUrl);
		}
	};

	// GET /api/Ecommerce/config/public - Obtener la configuración pública
	static async getPublicConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const configObj = await EcommerceService.getPublicConfig(req.models!);
			res.status(200).json(configObj);
		} catch (error) {
			next(error);
		}
	}

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

			const { config: updatedConfig, shouldRecalculate } = await EcommerceService.updateConfig(req.models!, data, userId);

			res.status(200).json({
				success: true,
				message: 'Configuración actualizada exitosamente',
				data: updatedConfig,
				shouldRecalculate
			});
		} catch (error) {
			next(error);
		}
	}

	// POST /api/Ecommerce/config/recalculate-prices - Recálculo masivo manual
	static async triggerRecalculation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			await EcommerceService.triggerPriceRecalculation(req.models!);
			res.status(200).json({
				success: true,
				message: 'Recálculo masivo de precios completado'
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
