import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { connectionManager } from '@/config/multitenancy';
import { IUser, Role } from '@/interfaces/user.interface';
import { EmployeePermission } from '@/interfaces/permission.interface';
import { AppError } from '@/errors/app.error';
import { TenantRequest } from './tenant';
import { validateTenantSubscriptionIntegrity } from './planGuard';
import { PANEL_COOKIE_NAME, PANEL_TOKEN_AUDIENCE, PanelAuthService } from '@/services/auth/panelAuth.service';
import { STOREFRONT_COOKIE_NAME, STOREFRONT_TOKEN_AUDIENCE } from '@/services/auth/storefrontAuth.service';

export interface AuthRequest extends TenantRequest {
	user?: IUser;
	authAudience?: string;
}

export interface Auth0MercadoPago extends TenantRequest {
	query: {
		state: string;
		code: string;
	};
}

interface JwtPayload {
	userID: string;
	tenantSlug?: string;
	role?: string;
	tokenVersion?: number;
	aud?: string;
	iat: number;
	exp: number;
}

function extractTokenFromRequest(req: TenantRequest, preferredSurface?: 'panel' | 'storefront'): string | undefined {
	const authHeader = req.headers.authorization;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		return authHeader.split(' ')[1];
	}
	const cookies = req.cookies || {};
	if (preferredSurface === 'panel') {
		if (cookies[PANEL_COOKIE_NAME] && cookies[PANEL_COOKIE_NAME] !== 'none') return cookies[PANEL_COOKIE_NAME];
		return undefined;
	}
	if (preferredSurface === 'storefront') {
		if (cookies[STOREFRONT_COOKIE_NAME] && cookies[STOREFRONT_COOKIE_NAME] !== 'none') return cookies[STOREFRONT_COOKIE_NAME];
		return undefined;
	}
	if (cookies[PANEL_COOKIE_NAME] && cookies[PANEL_COOKIE_NAME] !== 'none') return cookies[PANEL_COOKIE_NAME];
	if (cookies[STOREFRONT_COOKIE_NAME] && cookies[STOREFRONT_COOKIE_NAME] !== 'none') return cookies[STOREFRONT_COOKIE_NAME];
	return undefined;
}

/**
 * Protect routes from unauthenticated users.
 * MULTI-TENANT: Valida JWT, audience, tenantSlug, tokenVersion y estado activo del usuario.
 */
export const protect = async (
	req: AuthRequest,
	_res: Response,
	next: NextFunction
): Promise<Response | void> => {
	try {
		const isPanelRoute =
			req.baseUrl.includes('/pos') ||
			req.baseUrl.includes('/cash-register') ||
			req.baseUrl.includes('/role-profiles') ||
			req.baseUrl.includes('/addons') ||
			req.originalUrl.includes('/admin');

		const token = extractTokenFromRequest(req, isPanelRoute ? 'panel' : undefined);
		if (!token) {
			throw new AppError('Token not found', 'No se proporcionó token de autenticación', 401);
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

		// Validar aislamiento cruzado de tiendas
		if (decoded.tenantSlug && req.tenant?.slug) {
			if (decoded.tenantSlug.trim().toLowerCase() !== req.tenant.slug.trim().toLowerCase()) {
				throw new AppError('Tenant mismatch', 'Tu sesión no corresponde a esta tienda.', 403);
			}
		}

		if (!req.models || !req.tenant) {
			throw new AppError('Tenant not resolved', 'Tenant no resuelto antes de autenticación', 500);
		}

		// Cero retrocompatibilidad: exigir audience explícito ('vexx_panel' o 'vexx_storefront')
		if (decoded.aud !== PANEL_TOKEN_AUDIENCE && decoded.aud !== STOREFRONT_TOKEN_AUDIENCE) {
			throw new AppError('Invalid token audience', 'Tu sesión caducó por actualización de seguridad. Volvé a iniciar sesión.', 401);
		}

		let user: IUser | null = null;

		if (decoded.aud === PANEL_TOKEN_AUDIENCE && decoded.role === Role.admin) {
			const StoreOwnerModel = connectionManager.getStoreOwnerModel();
			const owner = await StoreOwnerModel.findOne({
				_id: decoded.userID,
				tenantId: req.tenant._id
			}).lean();

			if (!owner) {
				throw new AppError('Owner not found', 'Cuenta de dueño no encontrada para esta tienda.', 401);
			}
			if (owner.isActive === false) {
				throw new AppError('User suspended', 'Tu cuenta se encuentra suspendida o revocada.', 403);
			}

			const expectedVersion = owner.tokenVersion ?? 0;
			const tokenVersion = decoded.tokenVersion ?? 0;
			if (tokenVersion !== expectedVersion) {
				throw new AppError('Session revoked', 'Tu sesión fue cerrada porque se actualizaron tus credenciales.', 401);
			}

			user = PanelAuthService.sanitizeOwnerUser(owner as any) as unknown as IUser;
		} else {
			const dbUser = (await req.models.User.findById(decoded.userID).lean()) as IUser | null;
			if (!dbUser) throw new AppError('User not found', 'Usuario no encontrado', 401);
			if (dbUser.isActive === false) {
				throw new AppError('User suspended', 'Tu cuenta se encuentra suspendida o revocada por el administrador', 403);
			}

			const expectedVersion = dbUser.tokenVersion ?? 0;
			const tokenVersion = decoded.tokenVersion ?? 0;
			if (tokenVersion !== expectedVersion) {
				throw new AppError('Session revoked', 'Tu sesión fue cerrada porque se actualizaron tus credenciales o permisos.', 401);
			}

			if (decoded.aud === STOREFRONT_TOKEN_AUDIENCE && dbUser.role !== Role.user) {
				throw new AppError('Audience mismatch', 'Token de tienda inválido para cuentas administrativas.', 403);
			}
			if (decoded.aud === PANEL_TOKEN_AUDIENCE && dbUser.role !== Role.employee) {
				throw new AppError('Audience mismatch', 'Token de panel inválido para esta cuenta.', 403);
			}

			user = dbUser;
		}

		validateTenantSubscriptionIntegrity(req.tenant);

		req.user = user;
		req.authAudience = decoded.aud;
		next();
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new AppError('Failed to authenticate', 'Sesión inválida o expirada', 401);
	}
};

// Middleware para autorizar roles específicos
export const authorize = (...roles: string[]) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: 'Usuario no autenticado'
			});
		}

		if (req.authAudience === STOREFRONT_TOKEN_AUDIENCE && (roles.includes('admin') || roles.includes('employee'))) {
			return res.status(403).json({
				success: false,
				message: 'Una sesión de tienda pública no tiene acceso al panel administrativo'
			});
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				success: false,
				message: 'No tienes permisos para acceder a este recurso'
			});
		}

		return next();
	};
};

/**
 * Middleware para verificar si el usuario es admin
 */
export const adminOnly = authorize('admin');

/**
 * Middleware para personal operativo de tienda (admin o empleado / cajero)
 */
export const staffOnly = authorize('admin', 'employee');

/**
 * Middleware para validar permisos granulares en staff.
 * - Administradores (Role.admin): tienen bypass automático total.
 * - Empleados (Role.employee): deben tener al menos uno de los permisos requeridos.
 */
export const requirePermission = (...requiredPermissions: EmployeePermission[]) => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: 'Usuario no autenticado'
			});
		}

		if (req.authAudience === STOREFRONT_TOKEN_AUDIENCE) {
			return res.status(403).json({
				success: false,
				message: 'Sesión de tienda pública no autorizada para operaciones administrativas'
			});
		}

		if (req.user.role === Role.admin || (req.user.role as string) === 'admin') {
			return next();
		}

		if (req.user.role === Role.employee || (req.user.role as string) === 'employee') {
			const userPermissions = (req.user.permissions as EmployeePermission[]) || [];
			const hasAccess = requiredPermissions.some((perm) => userPermissions.includes(perm));

			if (hasAccess) {
				return next();
			}
		}

		return res.status(403).json({
			success: false,
			message: 'No posees los permisos requeridos para realizar esta operación',
			requiredPermissions
		});
	};
};

/**
 * Middleware para verificar si el usuario es propietario del recurso o admin
 */
export const ownerOrAdmin = (resourceUserIDField: string = 'userID') => {
	return (req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: 'Usuario no autenticado'
			});
		}

		const resourceUserID = req.params[resourceUserIDField] || req.body[resourceUserIDField];
		if (req.user.role === 'admin' || String(req.user._id) === resourceUserID) {
			return next();
		}

		return res.status(403).json({
			success: false,
			message: 'No tienes permisos para acceder a este recurso'
		});
	};
};

/**
 * Middleware opcional para obtener usuario si está autenticado.
 */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
	try {
		const token = extractTokenFromRequest(req, 'storefront');
		if (!token || !req.models) {
			return next();
		}

		try {
			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
			if (decoded.tenantSlug && req.tenant?.slug) {
				if (decoded.tenantSlug.trim().toLowerCase() !== req.tenant.slug.trim().toLowerCase()) {
					throw new AppError('Tenant mismatch', 'Tu sesión no corresponde a esta tienda.', 403);
				}
			}

			const user = (await req.models.User.findById(decoded.userID).lean()) as IUser | null;
			if (user && user.isActive && (decoded.tokenVersion ?? 0) === (user.tokenVersion ?? 0)) {
				req.user = user;
				req.authAudience = decoded.aud;
			}
		} catch {
			// Token inválido en middleware opcional: continuar como invitado
		}

		next();
	} catch {
		next();
	}
};
