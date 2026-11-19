import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { connectionManager } from '@/config/multitenancy';
import { getModelsForConnection } from '@/config/modelRegistry';
import { IUser, Role } from '@/interfaces/user.interface';
import { PANEL_COOKIE_NAME, PANEL_TOKEN_AUDIENCE, PanelAuthService } from '@/services/auth/panelAuth.service';
import { STOREFRONT_COOKIE_NAME, STOREFRONT_TOKEN_AUDIENCE } from '@/services/auth/storefrontAuth.service';
import { AuthSocket } from './socket.types';

interface SocketJwtPayload {
	userID: string;
	tenantSlug?: string;
	role?: string;
	tokenVersion?: number;
	aud?: string;
}

function extractSocketToken(socket: AuthSocket): string | undefined {
	if (socket.handshake.auth && typeof socket.handshake.auth.token === 'string' && socket.handshake.auth.token.trim()) {
		return socket.handshake.auth.token.trim();
	}

	if (socket.handshake.headers.authorization) {
		const authHeader = String(socket.handshake.headers.authorization).trim();
		if (authHeader.startsWith('Bearer ')) {
			return authHeader.split(' ')[1];
		}
		if (authHeader) {
			return authHeader;
		}
	}

	if (typeof socket.handshake.query?.token === 'string' && socket.handshake.query.token.trim()) {
		return socket.handshake.query.token.trim();
	}

	if (socket.handshake.headers.cookie) {
		try {
			const parsed = parse(socket.handshake.headers.cookie);
			const panelCookie = parsed[PANEL_COOKIE_NAME];
			if (panelCookie && panelCookie !== 'none') return panelCookie;
			const storefrontCookie = parsed[STOREFRONT_COOKIE_NAME];
			if (storefrontCookie && storefrontCookie !== 'none') return storefrontCookie;
			if (parsed['token_b'] && parsed['token_b'] !== 'none') return parsed['token_b'];
		} catch {
			// Ignorar cookie malformada
		}
	}

	return undefined;
}

function resolveSocketTenantSlug(socket: AuthSocket, decoded: SocketJwtPayload): string | undefined {
	if (socket.handshake.auth && typeof socket.handshake.auth.tenantSlug === 'string' && socket.handshake.auth.tenantSlug.trim()) {
		return socket.handshake.auth.tenantSlug.trim().toLowerCase();
	}

	const headerTenant = socket.handshake.headers['x-tenant-id'] || socket.handshake.headers['x-tenant-slug'];
	if (typeof headerTenant === 'string' && headerTenant.trim()) {
		return headerTenant.trim().toLowerCase();
	}

	const queryTenant = socket.handshake.query['tenantId'] || socket.handshake.query['tenantSlug'];
	if (typeof queryTenant === 'string' && queryTenant.trim()) {
		return queryTenant.trim().toLowerCase();
	}

	if (decoded.tenantSlug) {
		return String(decoded.tenantSlug).trim().toLowerCase();
	}

	return undefined;
}

/**
 * Middleware de autenticación para Socket.IO (SRP).
 * Soporta StoreOwner en master_db (PANEL_TOKEN_AUDIENCE + Role.admin) y usuarios/empleados de tenant.
 */
export async function socketAuthMiddleware(socket: AuthSocket, next: (err?: Error) => void): Promise<void> {
	try {
		const token = extractSocketToken(socket);
		if (!token) {
			return next(new Error('[WS] Authentication failed: No token provided'));
		}

		let decoded: SocketJwtPayload;
		try {
			decoded = jwt.verify(token, process.env.JWT_SECRET!) as SocketJwtPayload;
		} catch (err: any) {
			console.error('[WS] JWT verification failed:', err.message);
			return next(new Error('[WS] Authentication failed: Invalid or expired token'));
		}

		if (decoded.aud !== PANEL_TOKEN_AUDIENCE && decoded.aud !== STOREFRONT_TOKEN_AUDIENCE) {
			return next(new Error('[WS] Authentication failed: Invalid token audience'));
		}

		const tenantSlug = resolveSocketTenantSlug(socket, decoded);
		if (!tenantSlug) {
			return next(new Error('[WS] Authentication failed: No tenant specified'));
		}

		if (decoded.tenantSlug && decoded.tenantSlug.trim().toLowerCase() !== tenantSlug) {
			return next(new Error('[WS] Authentication failed: Tenant mismatch'));
		}

		const tenant = await connectionManager.getTenantBySlug(tenantSlug);
		if (!tenant) {
			return next(new Error('[WS] Tenant not found'));
		}

		let resolvedUser: IUser | null = null;

		if (decoded.aud === PANEL_TOKEN_AUDIENCE && decoded.role === Role.admin) {
			const StoreOwnerModel = connectionManager.getStoreOwnerModel();
			const owner = await StoreOwnerModel.findOne({
				_id: decoded.userID,
				tenantId: tenant._id
			}).lean();

			if (!owner || owner.isActive === false) {
				return next(new Error('[WS] StoreOwner not found or account is suspended'));
			}

			const expectedVersion = owner.tokenVersion ?? 0;
			const tokenVersion = decoded.tokenVersion ?? 0;
			if (tokenVersion !== expectedVersion) {
				return next(new Error('[WS] Session revoked: credentials updated'));
			}

			resolvedUser = PanelAuthService.sanitizeOwnerUser(owner as any) as unknown as IUser;
		} else {
			const tenantDb = connectionManager.getTenantDb(tenant.dbName);
			const models = getModelsForConnection(tenantDb);
			const dbUser = (await models.User.findById(decoded.userID).lean()) as IUser | null;

			if (!dbUser || dbUser.isActive === false) {
				return next(new Error('[WS] User not found or account is suspended'));
			}

			const expectedVersion = dbUser.tokenVersion ?? 0;
			const tokenVersion = decoded.tokenVersion ?? 0;
			if (tokenVersion !== expectedVersion) {
				return next(new Error('[WS] Session revoked: credentials updated'));
			}

			if (decoded.aud === STOREFRONT_TOKEN_AUDIENCE && dbUser.role !== Role.user) {
				return next(new Error('[WS] Audience mismatch for administrative account'));
			}

			resolvedUser = dbUser;
		}

		socket.user = resolvedUser;
		socket.tenantSlug = tenantSlug;
		socket.authAudience = decoded.aud;

		next();
	} catch (error: any) {
		console.error('[WS] Socket authentication error:', error);
		next(new Error('[WS] Authentication failed'));
	}
}
