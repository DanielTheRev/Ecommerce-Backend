import { NextFunction, Response } from 'express';
import { Auth0MercadoPago, AuthRequest } from '@/middleware/auth';
import { EcommerceService } from '@/services/ecommerce.service';
import { MercadoPagoService } from '@/services/mercadopago.service';
import { AppError } from '@/errors/app.error';

export class EcommerceConfigController {

	// GET /api/Ecommerce/config/dolares - Obtener todas las cotizaciones de DolarAPI
	static async getDolares(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { getAllDolares } = await import('@/services/dolar.service');
			const force = req.query.refresh === 'true';
			const dolares = await getAllDolares(force);
			res.status(200).json(dolares);
		} catch (error) {
			next(error);
		}
	}

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
		console.log('MercadoPago Callback:', { code, state });

		const panelBase = process.env.PANEL_URL || 'https://control-panel-50s.pages.dev';

		try {
			if (!code || typeof code !== 'string') {
				throw new Error('Código de autorización no proporcionado');
			}

			await EcommerceService.handleMercadoPagoOAuth(req.models!, code);

			const frontendURL = `${panelBase}/home/settings?mp_success=true`;
			return res.redirect(frontendURL);

		} catch (error) {
			console.error('Error en el controlador al vincular MP:', error);
			const errorUrl = `${panelBase}/home/settings?mp_error=true`;
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

	// PATCH /api/Ecommerce/config/logo - Actualizar logotipo
	static async updateLogo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			if (!req.file) {
				throw new AppError('Logo file is required', 'El archivo del logo es requerido', 400);
			}

			const { ImageService } = await import('@/services/images.service');
			const tenantSlug = req.tenant?.slug || 'global';
			const uploadedLogo = await ImageService.UploadImage(req.file, 'logo', `${tenantSlug}/config`);

			const userId = req.user ? (req.user._id as string).toString() : undefined;

			const { config: updatedConfig } = await EcommerceService.updateConfig(
				req.models!,
				{ logo: uploadedLogo.secure_url } as any,
				userId
			);

			res.status(200).json({
				success: true,
				message: 'Logotipo actualizado exitosamente',
				logo: updatedConfig.logo
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

	// GET /api/Ecommerce/config/recommendations - Obtener configuración de recomendaciones (admin)
	static async getRecommendationsConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const data = await EcommerceService.getRecommendationsConfig(req.models!);
			res.status(200).json(data);
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/Ecommerce/config/recommendations - Actualizar configuración de recomendaciones (admin)
	static async updateRecommendationsConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { limit, rules } = req.body;
			const data = await EcommerceService.updateRecommendationsConfig(req.models!, { limit, rules });
			res.status(200).json({
				success: true,
				message: 'Configuración de recomendaciones actualizada exitosamente',
				data
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
