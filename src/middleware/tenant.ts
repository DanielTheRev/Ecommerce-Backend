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
 * 1. Header `x-tenant-id` o Query param `tenantId`
 * 2. Body `tenantSlug` (para login / forms)
 * 3. Token JWT en Authorization Bearer o Cookie `token_b` (panel de control desacoplado)
 * 4. Params / URL (webhooks de Mercado Pago)
 * 5. Hostname/dominio
 *
 * Una vez resuelto, registra los modelos en la DB del tenant
 * y los pone disponibles en `req.models`.
 */
export const resolveTenant = async (
	req: TenantRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		let tenantSlug: string | undefined;

		// Prioridad 1: Extraer del body (para login con 3 campos - tiene la máxima prioridad)
		if (req.body) {
			if (typeof req.body.tenantSlug === 'string' && req.body.tenantSlug.trim()) {
				tenantSlug = req.body.tenantSlug.trim().toLowerCase();
			} else if (typeof req.body.tenant === 'string' && req.body.tenant.trim()) {
				tenantSlug = req.body.tenant.trim().toLowerCase();
			}
		}

		// Prioridad 2: Header x-tenant-id o query params (si tiene valor no vacío)
		if (!tenantSlug) {
			const headerTenant = req.headers['x-tenant-id'];
			if (typeof headerTenant === 'string' && headerTenant.trim() && headerTenant !== 'undefined' && headerTenant !== 'null') {
				tenantSlug = headerTenant.trim().toLowerCase();
			} else if (typeof req.query.tenantId === 'string' && (req.query.tenantId as string).trim()) {
				tenantSlug = (req.query.tenantId as string).trim().toLowerCase();
			} else if (typeof req.query.state === 'string' && (req.query.state as string).trim()) {
				tenantSlug = (req.query.state as string).trim().toLowerCase();
			}
		}

		// Prioridad 3: Extraer del JWT Token (Bearer header o Cookie)
		if (!tenantSlug) {
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

		// Prioridad 4: Intentar extraer de los params o webhook de Mercado Pago
		if (!tenantSlug) {
			if (req.params.tenantSlug) {
				tenantSlug = req.params.tenantSlug.trim().toLowerCase();
			} else if (req.originalUrl.includes('/mercadopago-notification/')) {
				const parts = req.originalUrl.split('/');
				const index = parts.findIndex(p => p === 'mercadopago-notification');
				if (index !== -1 && parts[index + 1]) {
					tenantSlug = parts[index + 1].split('?')[0].trim().toLowerCase();
				}
			}
		}

		let tenant: ITenant | null = null;

		if (tenantSlug) {
			tenant = await connectionManager.getTenantBySlug(tenantSlug);
		} else {
			// Prioridad 5: Resolver por dominio/hostname
			const hostname = req.hostname;
			if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
				tenant = await connectionManager.getTenantByDomain(hostname);
			}
		}

		if (!tenant) {
			console.warn(`⚠️ [TenantResolver] No se encontró el tenant para slug: "${tenantSlug}" en URL: ${req.originalUrl}`);
			throw new AppError(
				'Tenant not found or not specified',
				`No se encontró la tienda "${tenantSlug || 'no especificada'}". Verificá el identificador ingresado.`,
				400
			);
		}

		if (!tenant.isActive) {
			throw new AppError(
				'Tenant is inactive',
				'Este comercio está desactivado',
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
