import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '@/errors/app.error';
import { MasterAuthService } from '@/services/auth/masterAuth.service';

export interface MasterAuthRequest extends Request {
	masterUser?: {
		_id?: string;
		name?: string;
		role: string;
		isMaster: boolean;
		email: string;
		permissions?: string[];
	};
}

/**
 * Middleware de seguridad blindada para el centro de comando SuperAdmin (console.vexx).
 * Valida token JWT con aud: 'vexx_master' y tokenVersion vigente en master_db.master_operators,
 * o alternativamente la cabecera secreta x-master-key para scripts/CLI.
 */
export const requireSuperAdmin = async (
	req: MasterAuthRequest,
	_res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const masterKeyHeader = req.headers['x-master-key'] as string;
		const configuredMasterKey = process.env.MASTER_ADMIN_KEY;

		if (masterKeyHeader) {
			if (!configuredMasterKey || configuredMasterKey.trim().length < 16) {
				throw new AppError('Master Key Disabled', 'Autenticación maestra no configurada en el servidor', 500);
			}
			const headerHash = crypto.createHash('sha256').update(masterKeyHeader).digest();
			const configHash = crypto.createHash('sha256').update(configuredMasterKey).digest();

			if (crypto.timingSafeEqual(headerHash, configHash)) {
				req.masterUser = {
					email: 'master@vex.ar',
					role: 'superadmin',
					isMaster: true,
					permissions: ['*']
				};
				return next();
			}
		}

		const authHeader = req.headers.authorization;
		let token: string | undefined;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.split(' ')[1];
		} else if (req.cookies?.vexx_master_token && req.cookies.vexx_master_token !== 'none') {
			token = req.cookies.vexx_master_token;
		}

		if (!token) {
			throw new AppError(
				'Unauthorized Master Access',
				'Se requiere autenticación de SuperAdmin para acceder a esta ruta maestra.',
				401
			);
		}

		const operator = await MasterAuthService.verifyMasterTokenAndFetchOperator(token);
		req.masterUser = operator;
		next();
	} catch (error: any) {
		if (error instanceof AppError) {
			return next(error);
		}
		if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
			return next(new AppError('Invalid Master Token', 'Sesión maestra expirada o inválida.', 401));
		}
		next(new AppError('Master Auth Error', 'Error al validar credenciales maestras', 500));
	}
};

/**
 * Restringe acciones críticas de plataforma (como crear/editar operadores de Vexx) al rol 'superadmin'.
 */
export const requireRootSuperAdminOnly = (
	req: MasterAuthRequest,
	_res: Response,
	next: NextFunction
): void => {
	if (!req.masterUser || req.masterUser.role !== 'superadmin') {
		return next(
			new AppError(
				'Forbidden Root Action',
				'Solo el SuperAdmin titular puede gestionar operadores de plataforma.',
				403
			)
		);
	}
	next();
};
