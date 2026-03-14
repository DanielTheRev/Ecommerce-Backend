import { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
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
 * 1. Header `x-tenant-id` → slug del tenant (usado por paneles de control)
 * 2. Hostname/dominio → busca en la DB (para tiendas públicas a futuro)
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
		// Estrategia 1: Header x-tenant-id o query param tenantId
		const tenantSlug = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);

		let tenant: ITenant | null = null;

		if (tenantSlug) {
			console.log(`Resolviendo tenant por slug: ${tenantSlug}`);
			tenant = await connectionManager.getTenantBySlug(tenantSlug);
		} else {
			// Estrategia 2: Resolver por dominio/hostname
			console.log('Resolviendo tenant por hostname');
			const hostname = req.hostname;
			if (hostname && hostname !== 'localhost') {
				tenant = await connectionManager.getTenantByDomain(hostname);
			}
		}

		if (!tenant) {
			throw new AppError(
				'Tenant not found or not specified',
				'No se pudo identificar el tenant. Enviá el header x-tenant-id.',
				400
			);
		}

		if (!tenant.isActive) {
			throw new AppError(
				'Tenant is inactive',
				'Este tenant está desactivado',
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
			'Error al resolver el tenant',
			500
		));
	}
};
