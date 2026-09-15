import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '@/errors/app.error';

export interface MasterAuthRequest extends Request {
	masterUser?: {
		role: string;
		isMaster: boolean;
		email: string;
	};
}

interface MasterJwtPayload {
	email: string;
	role: string;
	isMaster: boolean;
	iat: number;
	exp: number;
}

/**
 * Middleware de seguridad blindada para el centro de comando SuperAdmin.
 * Valida un token JWT con role: 'superadmin' y flag isMaster: true,
 * o alternativamente la cabecera secreta x-master-key.
 */
export const requireSuperAdmin = (
	req: MasterAuthRequest,
	res: Response,
	next: NextFunction
): void => {
	try {
		const masterKeyHeader = req.headers['x-master-key'] as string;
		const configuredMasterKey = process.env.MASTER_ADMIN_KEY || 'vex_master_secret_2026';

		// Opción 1: Autenticación por Master Secret Key en header
		if (masterKeyHeader && masterKeyHeader === configuredMasterKey) {
			req.masterUser = {
				email: 'master@vex.ar',
				role: 'superadmin',
				isMaster: true
			};
			return next();
		}

		// Opción 2: Autenticación por Bearer JWT Token
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			throw new AppError(
				'Unauthorized Master Access',
				'Se requiere autenticación de SuperAdmin para acceder a esta ruta maestra.',
				401
			);
		}

		const token = authHeader.split(' ')[1];
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as MasterJwtPayload;

		if (decoded.role !== 'superadmin' || !decoded.isMaster) {
			throw new AppError(
				'Forbidden Master Access',
				'Acceso denegado: tu cuenta no posee privilegios de SuperAdmin.',
				403
			);
		}

		req.masterUser = {
			email: decoded.email,
			role: decoded.role,
			isMaster: decoded.isMaster
		};

		next();
	} catch (error: any) {
		if (error instanceof AppError) {
			return next(error);
		}
		if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
			return next(new AppError('Invalid Master Token', 'Sesión maestra expirada o inválida.', 401));
		}
		next(new AppError('Master Auth Error', 'Error al validar credenciales maestras', 500));
	}
};
