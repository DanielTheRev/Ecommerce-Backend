import { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError } from '@/errors/app.error';
import { ITenant } from '@/interfaces/tenant.interface';
import { TenantModels, getModelsForConnection } from '@/config/modelRegistry';
import { connectionManager } from '@/config/multitenancy';

/**
 * Extiende el Request de Express con propiedades multi-tenant.
 * Todos los controllers y middlewares downstream tienen acceso a:
 * - req.tenant: El documento del tenant
 * - req.tenantDb: La conexión mongoose a la DB del tenant
 * - req.models: Todos los modelos registrados en la DB del tenant
 */
export interface TenantRequest extends Request {
	tenant?: ITenant;
	tenantDb?: Connection;
	models?: TenantModels;
}

/**
 * Middleware que resuelve el tenant de la request.
 *
 * Estrategias de resolución (en orden de prioridad):
 * 0. Storefront API Key `x-api-key` o query `apiKey` (para storefronts y webs personalizadas)
 * 1. Body `tenantSlug` (para login / forms)
 * 2. Header `x-tenant-id` o Query param `tenantId`
 * 3. Token JWT en Authorization Bearer o Cookie `token_b` (panel de control)
 * 4. Params / URL (webhooks de Mercado Pago / Getnet)
 * 5. Hostname/dominio
 */
export const resolveTenant = async (
	req: TenantRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		let tenant: ITenant | null = null;
		let tenantSlug: string | undefined;

		// Prioridad 0: Storefront API Key (x-api-key o ?apiKey=...)
		const rawApiKey = req.headers['x-api-key'] || (req.query.apiKey as string);
		const apiKeyHeader = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;
		if (apiKeyHeader && typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
			tenant = await connectionManager.getTenantByApiKey(apiKeyHeader.trim());
			if (tenant) {
				tenantSlug = tenant.slug;
			}
		}

		// Prioridad 1: Extraer del body (para login con 3 campos - tiene la máxima prioridad)
		if (!tenant && req.body) {
			if (typeof req.body.tenantSlug === 'string' && req.body.tenantSlug.trim()) {
				tenantSlug = req.body.tenantSlug.trim().toLowerCase();
			} else if (typeof req.body.tenant === 'string' && req.body.tenant.trim()) {
				tenantSlug = req.body.tenant.trim().toLowerCase();
			}
		}

		// Prioridad 2: Extraer del JWT Token (Bearer header o Cookie del panel/usuario)
		if (!tenant && !tenantSlug) {
			const authHeader = req.headers.authorization;
			let token: string | undefined;
			if (authHeader && authHeader.startsWith('Bearer ')) {
				token = authHeader.split(' ')[1];
			} else if (req.cookies && req.cookies.token_b && req.cookies.token_b !== 'none') {
				token = req.cookies.token_b;
			}

			if (token) {
				try {
					const decoded = jwt.decode(token) as { tenantSlug?: string };
					if (decoded && decoded.tenantSlug && typeof decoded.tenantSlug === 'string') {
						tenantSlug = decoded.tenantSlug.trim().toLowerCase();
					}
				} catch (e) {
					// Ignorar error aquí
				}
			}
		}

		// Prioridad 3: Intentar extraer de los params o webhook
		if (!tenant && !tenantSlug) {
			if (req.params.tenantSlug) {
				tenantSlug = req.params.tenantSlug.trim().toLowerCase();
			} else if (req.originalUrl.includes('/mercadopago-notification/') || req.originalUrl.includes('/webhooks/')) {
				const parts = req.originalUrl.split('/');
				const index = parts.findIndex(p => p === 'mercadopago-notification' || p === 'webhooks');
				if (index !== -1 && parts[index + 1]) {
					tenantSlug = parts[index + 1].split('?')[0].trim().toLowerCase();
				}
			}
		}

		// Si es una petición pública que solo manda el viejo x-tenant-id sin x-api-key ni sesión: BLOQUEAR
		if (!tenant && !tenantSlug && req.headers['x-tenant-id']) {
			throw new AppError(
				'Storefront API Key Required',
				'El acceso público mediante x-tenant-id fue deshabilitado. Se requiere una Llave de Tienda válida (x-api-key) en los headers.',
				401
			);
		}

		if (!tenant) {
			if (tenantSlug) {
				tenant = await connectionManager.getTenantBySlug(tenantSlug);
			} else {
				// Prioridad 4: Resolver por dominio/hostname
				const hostname = req.hostname;
				if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
					tenant = await connectionManager.getTenantByDomain(hostname);
				}
			}
		}

		if (!tenant) {
			console.warn(`⚠️ [TenantResolver] No se encontró el tenant para slug/key: "${tenantSlug || apiKeyHeader || 'no provisto'}" en URL: ${req.originalUrl}`);
			throw new AppError(
				'Tenant not found or not specified',
				`No se encontró la tienda "${tenantSlug || 'no especificada'}". Verificá tu Llave de Tienda o identificador.`,
				400
			);
		}

		if (!tenant.isActive) {
			throw new AppError(
				'Tenant is inactive',
				'Este comercio está desactivado temporalmente.',
				403
			);
		}

		if (tenant.subscriptionStatus === 'suspended') {
			throw new AppError(
				'Subscription Suspended',
				'La suscripción de este comercio se encuentra suspendida. Contactá al administrador para reactivar el servicio.',
				403
			);
		}

		// Obtener la conexión a la DB del tenant
		const tenantDb = connectionManager.getTenantDb(tenant.dbName);

		// Registrar modelos en la conexión del tenant
		const models = getModelsForConnection(tenantDb);

		// Adjuntar al request
		req.tenant = tenant;
		req.tenantDb = tenantDb;
		req.models = models;

		next();
	} catch (error) {
		if (error instanceof AppError) {
			return next(error);
		}
		next(new AppError(
			'Failed to resolve tenant',
			'Error interno al conectar con la base de datos del comercio',
			500
		));
	}
};
