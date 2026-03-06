import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUser } from '@/interfaces/user.interface';
import { AppError } from '@/errors/app.error';
import { TenantRequest } from './tenant';

export interface AuthRequest extends TenantRequest {
	user?: IUser;
}

interface JwtPayload {
	userID: string;
	iat: number;
	exp: number;
}

// Middleware para proteger rutas
/**
 * Protect routes from unauthenticated users.
 * MULTI-TENANT: Usa req.models.User (de la DB del tenant) para buscar el usuario.
 */
export const protect = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
): Promise<Response | void> => {
	try {
		let token: string | undefined = req.cookies.token_b;
		// Verificar que existe el token
		if (!token) throw new AppError('Token not found', 'No se proporciono token', 401);
		// Verificar token
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

		// MULTI-TENANT: Buscar usuario en la DB del tenant
		if (!req.models) {
			throw new AppError('Tenant not resolved', 'Tenant no resuelto antes de autenticación', 500);
		}

		const user = await req.models.User.findById(decoded.userID).lean() as IUser;
		if (!user) throw new AppError('User not found', 'Usuario no encontrado', 401);

		// add user to every request
		req.user = user;

		next();
	} catch (error) {
		console.error('Error en middleware de autenticación:', error);
		if (error instanceof AppError) throw error;
		throw new AppError('Failed to login user', 'Error al intentar iniciar sesión', 500);
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

		// Si es admin o es el propietario del recurso
		if (req.user.role === 'admin' || (req.user._id as string).toString() === resourceUserID) {
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
 * MULTI-TENANT: Usa req.models.User.
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		let token: string | undefined;

		// Verificar token en headers
		if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
			token = req.headers.authorization.split(' ')[1];
		}
		// Verificar token en cookies
		else if (req.cookies.token_b) {
			token = req.cookies.token_b;
		}

		// Si no hay token, continuar sin usuario
		if (!token) {
			return next();
		}

		if (!req.models) {
			return next(); // Sin tenant resuelto, no podemos buscar el usuario
		}

		try {
			// Verificar token
			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

			// MULTI-TENANT: Buscar usuario en la DB del tenant
			const user = await req.models.User.findById(decoded.userID).lean() as IUser;

			if (user && user.isActive) {
				req.user = user;
			}
		} catch (error) {
			// Si hay error con el token, continuar sin usuario
			console.log('Token inválido en middleware opcional');
		}

		next();
	} catch (error) {
		console.error('Error en middleware de autenticación opcional:', error);
		next();
	}
};
