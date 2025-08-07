import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';

export interface AuthRequest extends Request {
	user?: IUser;
}

interface JwtPayload {
	userID: string;
	iat: number;
	exp: number;
}

// Middleware para proteger rutas
export const protect = async (
	req: AuthRequest,
	res: Response,
	next: NextFunction
): Promise<Response | void> => {
	try {
		let token: string | undefined;

		// Verificar token en headers
		if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
			token = req.headers.authorization.split(' ')[1];
		}
		// Verificar token en cookies
		else if (req.cookies.token) {
			token = req.cookies.token;
		}

		// Verificar que existe el token
		if (!token) {
			return res.status(401).json({
				success: false,
				message: 'Acceso no autorizado, token requerido'
			});
		}

		try {
			// Verificar token
			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
			// Buscar usuario actual
			const user = await User.findById(decoded.userID);

			if (!user) {
				return res.status(401).json({
					success: false,
					message: 'Usuario no encontrado'
				});
			}

			// Agregar usuario a la request
			req.user = user;
			next();
		} catch (error) {
			return res.status(401).json({
				success: false,
				message: 'Token inválido'
			});
		}
	} catch (error) {
		console.error('Error en middleware de autenticación:', error);
		return res.status(500).json({
			success: false,
			message: 'Error interno del servidor'
		});
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

// Middleware para verificar si el usuario es admin
export const adminOnly = authorize('admin');

// Middleware para verificar si el usuario es propietario del recurso o admin
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

// Middleware opcional para obtener usuario si está autenticado
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		let token: string | undefined;

		// Verificar token en headers
		if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
			token = req.headers.authorization.split(' ')[1];
		}
		// Verificar token en cookies
		else if (req.cookies.token) {
			token = req.cookies.token;
		}

		// Si no hay token, continuar sin usuario
		if (!token) {
			return next();
		}

		try {
			// Verificar token
			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

			// Buscar usuario actual
			const user = await User.findById(decoded.userID);

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
