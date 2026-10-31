import { NextFunction, Response } from 'express';
import { Auth0MercadoPago, AuthRequest } from '@/middleware/auth';
import { EcommerceService } from '@/services/ecommerce.service';
import { MercadoPagoService } from '@/services/mercadopago.service';
import { AppError } from '@/errors/app.error';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

	// GET /api/Ecommerce/config/mercadopago/auth-url - Generar URL segura de autorización OAuth con state firmado
	static async getMercadoPagoAuthUrl(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const tenantSlug = req.tenant?.slug;
			if (!tenantSlug) {
				throw new AppError('Tenant required', 'Se requiere identificar la tienda para vincular Mercado Pago', 400);
			}

			const masterClientId = process.env.MP_MASTER_CLIENT_ID;
			const redirectUri = process.env.MP_REDIRECT_URI;
			if (!redirectUri) {
				throw new AppError('Missing MP Credentials', 'Falta configurar la variable MP_REDIRECT_URI en tu archivo de entorno actual.', 500);
			}

			if (!masterClientId) {
				throw new AppError('Missing MP Credentials', 'Falta MP_MASTER_CLIENT_ID en la configuración del servidor', 500);
			}

			const jwtSecret = process.env.JWT_SECRET;
			if (!jwtSecret) {
				throw new AppError('Server configuration error', 'Falta JWT_SECRET en las variables de entorno', 500);
			}

			const nonce = crypto.randomBytes(16).toString('hex');

			// Token firmado anti-tampering y anti-CSRF con 15 minutos de validez
			const stateToken = jwt.sign(
				{
					tenantSlug,
					adminId: req.user?._id ? String(req.user._id) : undefined,
					nonce,
					purpose: 'mp_oauth_link'
				},
				jwtSecret,
				{ expiresIn: '15m' }
			);

			const authUrl = `https://auth.mercadopago.com/authorization?client_id=${masterClientId}&response_type=code&platform_id=mp&state=${encodeURIComponent(stateToken)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

			res.status(200).json({
				success: true,
				authUrl,
				state: stateToken
			});
		} catch (error) {
			next(error);
		}
	}

	static handleMercadoPagoCallback = async (req: Auth0MercadoPago, res: Response) => {
		const { code, state } = req.query;
		console.log('MercadoPago Callback:', { code, state });

		const panelBase = process.env.PANEL_URL;
		if (!panelBase) {
			console.error('❌ Falta configurar PANEL_URL en el archivo de entorno.');
			res.status(500).send('Error de configuración del servidor: Falta PANEL_URL en el entorno.');
			return;
		}

		try {
			if (!code || typeof code !== 'string') {
				throw new Error('Código de autorización no proporcionado');
			}

			if (!state || typeof state !== 'string') {
				console.warn('🚨 [Alerta de Seguridad] Callback de Mercado Pago recibido sin parámetro state');
				const errorUrl = `${panelBase}/home/settings?mp_error=missing_state`;
				return res.redirect(errorUrl);
			}

			const jwtSecret = process.env.JWT_SECRET;
			if (!jwtSecret) {
				throw new Error('Falta JWT_SECRET en variables de entorno');
			}

			let targetTenantSlug: string;

			try {
				const decoded = jwt.verify(state, jwtSecret) as { tenantSlug?: string; purpose?: string };
				if (!decoded.tenantSlug || decoded.purpose !== 'mp_oauth_link') {
					throw new Error('Token state inválido o propósito incorrecto');
				}
				targetTenantSlug = decoded.tenantSlug;
			} catch (jwtErr: any) {
				// Soporte retrocompatible seguro: si el state coincide exactamente con el tenant ya resuelto en la sesión autenticada del admin
				if (req.tenant?.slug && state.trim().toLowerCase() === req.tenant.slug.toLowerCase()) {
					console.log(`ℹ️ [OAuth MP] Aprobado por sesión de admin coincidente para slug: ${req.tenant.slug}`);
					targetTenantSlug = req.tenant.slug;
				} else {
					console.warn('🚨 [Alerta de Seguridad] Intento de vinculación Mercado Pago con state inválido o expirado:', jwtErr.message);
					const errorUrl = `${panelBase}/home/settings?mp_error=invalid_csrf_state`;
					return res.redirect(errorUrl);
				}
			}

			// Resolver conexión y modelos del tenant verificado
			const { connectionManager } = await import('@/config/multitenancy');
			const { getModelsForConnection } = await import('@/config/modelRegistry');
			const tenant = await connectionManager.getTenantBySlug(targetTenantSlug);

			if (!tenant) {
				throw new Error(`Tienda "${targetTenantSlug}" no encontrada`);
			}

			const tenantDb = connectionManager.getTenantDb(tenant.dbName);
			const targetModels = getModelsForConnection(tenantDb);

			await EcommerceService.handleMercadoPagoOAuth(targetModels, code);
			console.log(`✅ [OAuth MP] Cuenta de Mercado Pago vinculada exitosamente a la tienda: ${targetTenantSlug}`);

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
			const configObj = await EcommerceService.getPublicConfig(req.models!, req.tenant?.slug);
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

			const { config: updatedConfig, shouldRecalculate } = await EcommerceService.updateConfig(req.models!, data, userId, req.tenant?.slug);

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

	// POST /api/Ecommerce/config/recalculate-preview - Simulación / Vista previa de recálculo masivo
	static async previewRecalculation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const onlyActive = req.body?.onlyActive !== false;
			const previewData = await EcommerceService.previewPriceRecalculation(req.models!, onlyActive);
			res.status(200).json({
				success: true,
				...previewData
			});
		} catch (error) {
			next(error);
		}
	}

	// POST /api/Ecommerce/config/recalculate-prices - Recálculo masivo manual confirmado
	static async triggerRecalculation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const onlyActive = req.body?.onlyActive !== false;
			const result = await EcommerceService.triggerPriceRecalculation(req.models!, onlyActive, req.tenant?.slug);
			res.status(200).json({
				success: true,
				message: `Recálculo masivo completado. ${result.updatedCount} productos actualizados`,
				updatedCount: result.updatedCount
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

	// GET /api/config/catalog-ranking - Obtener configuración de ranking del catálogo
	static async getCatalogRankingConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const data = await EcommerceService.getCatalogRankingConfig(req.models!);
			res.status(200).json(data);
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/config/catalog-ranking - Actualizar configuración de ranking del catálogo
	static async updateCatalogRankingConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { active, viewWeight, cartWeight, saleWeight } = req.body;
			const data = await EcommerceService.updateCatalogRankingConfig(req.models!, {
				active,
				viewWeight,
				cartWeight,
				saleWeight
			});
			res.status(200).json({
				success: true,
				message: 'Configuración de ranking de catálogo actualizada',
				data
			});
		} catch (error) {
			next(error);
		}
	}

	// POST /api/config/catalog-ranking/recalculate - Recalcular scores de ranking masivamente
	static async recalculateRankingScores(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { ProductService } = await import('@/services/product.service');
			const result = await ProductService.recalculateAllEffectiveScores(req.models!);
			res.status(200).json({
				success: true,
				message: `Recálculo de ranking completado. ${result.updatedCount} productos actualizados.`,
				updatedCount: result.updatedCount
			});
		} catch (error) {
			next(error);
		}
	}

	// POST /api/config/catalog-ranking/reset-base - Reiniciar scores ELO a base (masivo)
	static async resetRankingBaseScores(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { resetBaseTo100 } = req.body || {};
			const { ProductService } = await import('@/services/product.service');
			const result = await ProductService.resetAllToRankingBase(req.models!, Boolean(resetBaseTo100));
			res.status(200).json({
				success: true,
				message: `Reinicio de ranking a base completado. ${result.updatedCount} productos reiniciados.`,
				updatedCount: result.updatedCount
			});
		} catch (error) {
			next(error);
		}
	}

	// POST /api/Ecommerce/config/test-email - Enviar email de prueba
	static async sendTestEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { templateKey, recipientEmail } = req.body;
			if (!recipientEmail) {
				throw new AppError('Recipient email is required', 'El email destinatario es requerido', 400);
			}

			const { ResendService } = await import('@/services/resend.service');
			await ResendService.sendTestEmail(templateKey || 'orderConfirmation', recipientEmail, req.models!);

			res.status(200).json({
				success: true,
				message: `Email de prueba enviado exitosamente a ${recipientEmail}`
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

	// GET /api/config/connection - Obtener configuración de llaves y dominios
	static async getConnectionSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { connectionManager } = await import('@/config/multitenancy');
			const masterDb = connectionManager.getMasterDb();
			const TenantModel = masterDb.model<any>('Tenant');
			let tenant = await TenantModel.findById(req.tenant?._id);

			if (!tenant) {
				throw new AppError('Tenant not found', 'No se encontró la tienda', 404);
			}

			// Si no tiene apiKey generada aún, le generamos una automáticamente
			if (!tenant.apiKey) {
				const crypto = await import('crypto');
				const randomHex = crypto.randomBytes(16).toString('hex');
				tenant.apiKey = `pk_live_${tenant.slug}_${randomHex}`;
				await tenant.save();
				connectionManager.invalidateTenantCache(tenant.slug);
			}

			res.status(200).json({
				apiKey: tenant.apiKey,
				allowedOrigins: tenant.settings?.allowedOrigins || [],
				subscriptionStatus: tenant.subscriptionStatus || 'active',
				slug: tenant.slug,
				name: tenant.name
			});
		} catch (error) {
			next(error);
		}
	}

	// POST /api/config/connection/regenerate-key - Regenerar Storefront API Key
	static async regenerateApiKey(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { connectionManager } = await import('@/config/multitenancy');
			const masterDb = connectionManager.getMasterDb();
			const TenantModel = masterDb.model<any>('Tenant');
			const tenant = await TenantModel.findById(req.tenant?._id);

			if (!tenant) {
				throw new AppError('Tenant not found', 'No se encontró la tienda', 404);
			}

			const crypto = await import('crypto');
			const randomHex = crypto.randomBytes(16).toString('hex');
			const newKey = `pk_live_${tenant.slug}_${randomHex}`;
			const oldKey = tenant.apiKey;

			tenant.apiKey = newKey;
			await tenant.save();

			connectionManager.invalidateTenantCache(tenant.slug);
			if (oldKey) {
				connectionManager.invalidateTenantCache(oldKey);
			}

			res.status(200).json({
				success: true,
				message: 'Nueva llave de conexión generada exitosamente',
				apiKey: newKey
			});
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/config/connection/allowed-origins - Actualizar dominios permitidos
	static async updateAllowedOrigins(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { allowedOrigins } = req.body;
			if (!Array.isArray(allowedOrigins)) {
				throw new AppError('Invalid format', 'allowedOrigins debe ser un array de strings', 400);
			}

			const { connectionManager } = await import('@/config/multitenancy');
			const masterDb = connectionManager.getMasterDb();
			const TenantModel = masterDb.model<any>('Tenant');
			const tenant = await TenantModel.findById(req.tenant?._id);

			if (!tenant) {
				throw new AppError('Tenant not found', 'No se encontró la tienda', 404);
			}

			if (!tenant.settings) {
				tenant.settings = { allowedOrigins: [] };
			}

			// Limpieza de dominios (trim y sin trailing slash)
			tenant.settings.allowedOrigins = allowedOrigins
				.map((d: string) => String(d).trim().replace(/\/+$/, ''))
				.filter(Boolean);

			await tenant.save();
			connectionManager.invalidateTenantCache(tenant.slug);

			res.status(200).json({
				success: true,
				message: 'Dominios permitidos actualizados exitosamente',
				allowedOrigins: tenant.settings.allowedOrigins
			});
		} catch (error) {
			next(error);
		}
	}
}
