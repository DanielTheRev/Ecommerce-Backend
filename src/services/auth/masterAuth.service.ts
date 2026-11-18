import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { connectionManager } from '@/config/multitenancy';
import { AppError } from '@/errors/app.error';
import { IMasterOperator, MasterOperatorRole, MasterOperatorSchema } from '@/models/MasterOperator.model';
import { EmailSecurityUtil } from '@/utils/emailSecurity.util';
import { ResendService } from '@/services/resend.service';

export const MASTER_TOKEN_AUDIENCE = 'vexx_master';

export class MasterAuthService {
	private static getModel() {
		const masterDb = connectionManager.getMasterDb();
		if (!masterDb.models.MasterOperator) {
			masterDb.model<IMasterOperator>('MasterOperator', MasterOperatorSchema);
		}
		return masterDb.model<IMasterOperator>('MasterOperator');
	}

	static generateMasterToken(operator: Pick<IMasterOperator, '_id' | 'email' | 'role' | 'tokenVersion'>, rememberMe = false): string {
		const jwtSecret = process.env.JWT_SECRET;
		if (!jwtSecret) {
			throw new AppError('Server configuration error', 'Falta JWT_SECRET en el servidor.', 500);
		}
		return jwt.sign(
			{
				operatorId: String(operator._id),
				email: operator.email,
				role: operator.role,
				isMaster: true,
				tokenVersion: operator.tokenVersion ?? 0
			},
			jwtSecret,
			{
				audience: MASTER_TOKEN_AUDIENCE,
				expiresIn: rememberMe ? '7d' : '24h'
			}
		);
	}

	/**
	 * Login exclusivo de console.vexx contra master_db.master_operators (email + password).
	 * Cero fallbacks a llaves maestras compartidas.
	 */
	static async login(params: { email?: string; password?: string; rememberMe?: boolean }) {
		const { email, password, rememberMe = false } = params;
		if (!email || !password) {
			throw new AppError('Invalid Credentials', 'Ingresá tu email y contraseña de operador.', 401);
		}

		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(email);
		EmailSecurityUtil.enforceRateLimit(
			`master_login:${cleanEmail}`,
			8,
			15 * 60 * 1000,
			15 * 60 * 1000,
			'Demasiados intentos de ingreso a Console Vexx. Esperá 15 minutos.'
		);

		const Model = this.getModel();
		const operator = await Model.findOne({ email: cleanEmail }).select('+password');
		if (!operator || !operator.comparePassword || !(await operator.comparePassword(password))) {
			throw new AppError('Invalid Credentials', 'Correo o contraseña incorrectos.', 401);
		}
		if (!operator.isActive) {
			throw new AppError('Account suspended', 'Tu cuenta de operador está desactivada.', 403);
		}

		EmailSecurityUtil.clearRateLimit(`master_login:${cleanEmail}`);
		operator.lastLoginAt = new Date();
		await operator.save();

		const token = this.generateMasterToken(operator, rememberMe);
		return {
			token,
			user: {
				_id: String(operator._id),
				name: operator.name,
				email: operator.email,
				role: operator.role,
				permissions: operator.permissions || [],
				isMaster: true,
				platform: 'VEXX'
			}
		};
	}

	static async forgotPassword(rawEmail: unknown): Promise<{ success: boolean; message: string }> {
		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(rawEmail);
		EmailSecurityUtil.enforceRateLimit(
			`master_forgot:${cleanEmail}`,
			3,
			15 * 60 * 1000,
			15 * 60 * 1000,
			'Ya enviamos una solicitud reciente. Esperá unos minutos antes de reintentar.'
		);

		const Model = this.getModel();
		const operator = await Model.findOne({ email: cleanEmail, isActive: true });
		if (operator) {
			const { rawToken, tokenHash, expiresAt } = EmailSecurityUtil.generateResetToken(15);
			operator.resetPasswordTokenHash = tokenHash;
			operator.resetPasswordExpiresAt = expiresAt;
			await operator.save();

			const consoleBase = (process.env.CONSOLE_URL || 'https://console.vexx.com.ar').replace(/\/+$/, '');
			const resetUrl = `${consoleBase}/reset-password?token=${rawToken}&email=${encodeURIComponent(cleanEmail)}`;
			await ResendService.sendPlatformPasswordResetEmail({
				email: cleanEmail,
				recipientName: operator.name,
				resetUrl,
				rawToken
			});
		}

		return {
			success: true,
			message: 'Si el correo está registrado en Vexx Console, te enviamos las instrucciones de recuperación.'
		};
	}

	static async resetPassword(params: { token: string; newPassword: string; email?: string }): Promise<{ success: boolean; message: string }> {
		const rawToken = String(params.token || '').trim();
		const newPassword = String(params.newPassword || '');
		if (!rawToken || newPassword.length < 8) {
			throw new AppError('Validation Error', 'El token es obligatorio y la nueva contraseña debe tener al menos 8 caracteres.', 400);
		}

		const tokenHash = EmailSecurityUtil.hashToken(rawToken);
		const Model = this.getModel();
		const query: Record<string, unknown> = {
			resetPasswordTokenHash: tokenHash,
			resetPasswordExpiresAt: { $gt: new Date() },
			isActive: true
		};
		if (params.email) {
			query.email = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		}

		const operator = await Model.findOne(query).select('+resetPasswordTokenHash +resetPasswordExpiresAt');
		if (!operator) {
			throw new AppError('Invalid or expired token', 'El enlace de recuperación es inválido o venció.', 400);
		}

		operator.password = newPassword;
		operator.resetPasswordTokenHash = undefined;
		operator.resetPasswordExpiresAt = undefined;
		operator.tokenVersion = (operator.tokenVersion || 0) + 1;
		await operator.save();

		return {
			success: true,
			message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión.'
		};
	}

	// =========================================================================
	// GESTIÓN DE OPERADORES / EMPLEADOS DE VEXX DESDE console.vexx
	// =========================================================================

	static async listOperators() {
		const Model = this.getModel();
		return Model.find().sort({ createdAt: -1 }).lean();
	}

	static async createOperator(dto: {
		name: string;
		email: string;
		password: string;
		role?: MasterOperatorRole;
		permissions?: string[];
	}) {
		if (!dto.name || !dto.name.trim()) {
			throw new AppError('Validation Error', 'El nombre del operador es obligatorio.', 400);
		}
		if (!dto.password || dto.password.length < 8) {
			throw new AppError('Validation Error', 'La contraseña debe tener al menos 8 caracteres.', 400);
		}
		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(dto.email);
		const Model = this.getModel();
		const existing = await Model.findOne({ email: cleanEmail }).lean();
		if (existing) {
			throw new AppError('Conflict', `Ya existe un operador con el email '${cleanEmail}'.`, 409);
		}

		const created = await Model.create({
			name: dto.name.trim(),
			email: cleanEmail,
			password: dto.password,
			role: dto.role === 'superadmin' ? 'superadmin' : 'operator',
			permissions: Array.isArray(dto.permissions) ? dto.permissions : [],
			isActive: true,
			tokenVersion: 0
		});

		const obj = created.toObject();
		delete obj.password;
		return obj;
	}

	static async updateOperator(
		operatorId: string,
		dto: { name?: string; role?: MasterOperatorRole; permissions?: string[]; isActive?: boolean; password?: string }
	) {
		const Model = this.getModel();
		const operator = await Model.findById(operatorId);
		if (!operator) {
			throw new AppError('Not Found', 'Operador no encontrado.', 404);
		}

		if (dto.name !== undefined) operator.name = dto.name.trim();
		if (dto.role === 'superadmin' || dto.role === 'operator') operator.role = dto.role;
		if (Array.isArray(dto.permissions)) operator.permissions = dto.permissions;
		if (typeof dto.isActive === 'boolean') {
			operator.isActive = dto.isActive;
			if (!dto.isActive) {
				operator.tokenVersion = (operator.tokenVersion || 0) + 1;
			}
		}
		if (dto.password) {
			if (dto.password.length < 8) {
				throw new AppError('Validation Error', 'La contraseña debe tener al menos 8 caracteres.', 400);
			}
			operator.password = dto.password;
			operator.tokenVersion = (operator.tokenVersion || 0) + 1;
		}

		await operator.save();
		const obj = operator.toObject();
		delete obj.password;
		return obj;
	}

	static async verifyMasterTokenAndFetchOperator(token: string) {
		const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
			audience: MASTER_TOKEN_AUDIENCE
		}) as {
			operatorId?: string;
			email: string;
			role: string;
			isMaster: boolean;
			tokenVersion?: number;
		};

		if (!decoded.isMaster || !['superadmin', 'operator'].includes(decoded.role)) {
			throw new AppError('Forbidden Master Access', 'Acceso denegado: privilegios insuficientes.', 403);
		}

		if (decoded.operatorId) {
			const Model = this.getModel();
			const operator = await Model.findById(decoded.operatorId).lean();
			if (!operator || !operator.isActive) {
				throw new AppError('Unauthorized Master Access', 'Tu cuenta de operador fue desactivada o eliminada.', 401);
			}
			if ((operator.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
				throw new AppError('Session Revoked', 'Tu sesión expiró porque se actualizaron tus credenciales.', 401);
			}
			return {
				_id: String(operator._id),
				name: operator.name,
				email: operator.email,
				role: operator.role,
				permissions: operator.permissions || [],
				isMaster: true
			};
		}

		return {
			email: decoded.email,
			role: decoded.role,
			isMaster: decoded.isMaster,
			permissions: ['*']
		};
	}
}
