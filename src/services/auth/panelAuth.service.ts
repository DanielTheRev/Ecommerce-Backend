import jwt from 'jsonwebtoken';
import { connectionManager } from '@/config/multitenancy';
import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { AuthError } from '@/errors/auth.error';
import { IStoreOwner } from '@/models/StoreOwner.model';
import { ISecureUser, IUser, Role } from '@/interfaces/user.interface';
import { EmailSecurityUtil } from '@/utils/emailSecurity.util';
import { ResendService } from '@/services/resend.service';

export const PANEL_TOKEN_AUDIENCE = 'vexx_panel';
export const PANEL_COOKIE_NAME = 'vexx_panel_token';

export class PanelAuthService {
	static generatePanelToken(
		user: Pick<IUser, '_id' | 'role' | 'tokenVersion'>,
		tenantSlug?: string,
		rememberMe = false
	): string {
		const jwtSecret = process.env.JWT_SECRET;
		if (!jwtSecret) {
			throw new AppError('Server configuration error', 'Falta JWT_SECRET en el servidor.', 500);
		}
		return jwt.sign(
			{
				userID: String(user._id),
				tenantSlug,
				role: user.role,
				tokenVersion: user.tokenVersion ?? 0
			},
			jwtSecret,
			{
				audience: PANEL_TOKEN_AUDIENCE,
				expiresIn: rememberMe ? '15d' : '12h'
			}
		);
	}

	static getCookieOptions(rememberMe = false) {
		const maxAgeMs = rememberMe ? 15 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
		return {
			expires: new Date(Date.now() + maxAgeMs),
			maxAge: maxAgeMs,
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax'
		};
	}

	static sanitizeStaffUser(user: IUser): ISecureUser {
		return {
			_id: String(user._id),
			name: user.name,
			lastName: user.lastName,
			dni: user.dni,
			phone: user.phone,
			email: user.email,
			role: user.role,
			position: user.position,
			permissions: user.permissions || [],
			roleProfileId: user.roleProfileId ? String(user.roleProfileId) : undefined,
			profilePhoto: user.profilePhoto,
			isEmailVerified: user.isEmailVerified,
			tokenVersion: user.tokenVersion ?? 0,
			lastLoginAt: user.lastLoginAt,
			isActive: user.isActive,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		};
	}

	static sanitizeOwnerUser(owner: IStoreOwner): ISecureUser {
		return {
			_id: String(owner._id),
			name: owner.name,
			lastName: owner.lastName,
			dni: owner.dni,
			phone: owner.phone,
			email: owner.email,
			role: Role.admin,
			permissions: [],
			profilePhoto: owner.profilePhoto,
			isEmailVerified: owner.isEmailVerified,
			tokenVersion: owner.tokenVersion ?? 0,
			lastLoginAt: owner.lastLoginAt,
			isActive: owner.isActive,
			createdAt: owner.createdAt,
			updatedAt: owner.updatedAt
		};
	}

	/**
	 * Login exclusivo del Dueño del Comercio (StoreOwner en master_db).
	 * Nunca consulta la colección users del tenant ni acepta clientes/empleados.
	 */
	static async loginAdmin(params: {
		tenantId: string;
		email: string;
		password: string;
		tenantSlug?: string;
	}): Promise<ISecureUser> {
		if (!params.tenantId) {
			throw new AppError('Tenant required', 'No se pudo identificar el comercio.', 400);
		}
		if (!params.email || !params.password) {
			throw new AuthError('Missing credentials', 'Ingresá tu email y contraseña.', 400);
		}

		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		EmailSecurityUtil.enforceRateLimit(
			`panel_login:${params.tenantSlug || params.tenantId}:${cleanEmail}`,
			10,
			15 * 60 * 1000,
			15 * 60 * 1000,
			'Demasiados intentos fallidos. Esperá 15 minutos antes de reintentar.'
		);

		const StoreOwnerModel = connectionManager.getStoreOwnerModel();
		const owner = await StoreOwnerModel.findOne({
			tenantId: params.tenantId,
			email: cleanEmail
		}).select('+password');

		if (!owner || !(await owner.comparePassword!(params.password))) {
			throw new AuthError('Invalid credentials', 'Credenciales inválidas.', 401);
		}

		if (owner.isActive === false) {
			throw new AuthError('Account suspended', 'Tu cuenta está suspendida o inactiva.', 403);
		}

		EmailSecurityUtil.clearRateLimit(`panel_login:${params.tenantSlug || params.tenantId}:${cleanEmail}`);
		owner.lastLoginAt = new Date();
		await owner.save();

		return this.sanitizeOwnerUser(owner.toObject() as unknown as IStoreOwner);
	}

	static async getOwnerProfile(ownerId: string, tenantId: string): Promise<ISecureUser> {
		const StoreOwnerModel = connectionManager.getStoreOwnerModel();
		const owner = await StoreOwnerModel.findOne({ _id: ownerId, tenantId }).lean();
		if (!owner) {
			throw new AppError('Owner not found', 'Cuenta de dueño no encontrada.', 404);
		}
		return this.sanitizeOwnerUser(owner as unknown as IStoreOwner);
	}

	static async updateOwnerProfile(
		ownerId: string,
		tenantId: string,
		data: {
			name?: string;
			lastName?: string;
			phone?: string;
			dni?: string;
			email?: string;
			profilePhoto?: string;
		}
	): Promise<{ user: ISecureUser; emailChanged: boolean }> {
		const StoreOwnerModel = connectionManager.getStoreOwnerModel();
		const owner = await StoreOwnerModel.findOne({ _id: ownerId, tenantId });
		if (!owner) {
			throw new AppError('Owner not found', 'Cuenta de dueño no encontrada.', 404);
		}

		let emailChanged = false;
		if (data.email !== undefined) {
			const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(data.email);
			if (cleanEmail !== owner.email) {
				const existing = await StoreOwnerModel.findOne({
					tenantId,
					email: cleanEmail,
					_id: { $ne: ownerId }
				}).lean();
				if (existing) {
					throw new AppError('Email in use', 'Ya existe otro dueño con ese email en este comercio.', 400);
				}
				owner.email = cleanEmail;
				emailChanged = true;
			}
		}

		if (data.name !== undefined) {
			const trimmedName = data.name.trim();
			if (!trimmedName) {
				throw new AppError('Validation Error', 'El nombre no puede estar vacío.', 400);
			}
			owner.name = trimmedName;
		}
		if (data.lastName !== undefined) owner.lastName = data.lastName.trim();
		if (data.phone !== undefined) owner.phone = data.phone.trim();
		if (data.dni !== undefined) owner.dni = data.dni.trim();
		if (data.profilePhoto !== undefined) owner.profilePhoto = data.profilePhoto;

		if (emailChanged) {
			owner.tokenVersion = (owner.tokenVersion || 0) + 1;
		}

		await owner.save();
		return {
			user: this.sanitizeOwnerUser(owner.toObject() as unknown as IStoreOwner),
			emailChanged
		};
	}

	static async changeOwnerPassword(
		ownerId: string,
		tenantId: string,
		params: { currentPassword: string; newPassword: string }
	): Promise<{ success: boolean; message: string }> {
		const currentPassword = String(params.currentPassword || '');
		const newPassword = String(params.newPassword || '');
		if (!currentPassword || newPassword.length < 6) {
			throw new AppError(
				'Validation Error',
				'Ingresá tu contraseña actual y una nueva contraseña de al menos 6 caracteres.',
				400
			);
		}

		const StoreOwnerModel = connectionManager.getStoreOwnerModel();
		const owner = await StoreOwnerModel.findOne({ _id: ownerId, tenantId }).select('+password');
		if (!owner || !(await owner.comparePassword!(currentPassword))) {
			throw new AuthError('Invalid credentials', 'La contraseña actual es incorrecta.', 401);
		}

		owner.password = newPassword;
		owner.tokenVersion = (owner.tokenVersion || 0) + 1;
		await owner.save();

		return {
			success: true,
			message: 'Contraseña actualizada correctamente. Todas las sesiones anteriores fueron cerradas.'
		};
	}

	static async forgotAdminPassword(
		models: TenantModels,
		tenantId: string,
		rawEmail: unknown,
		tenantSlug?: string
	): Promise<{ success: boolean; message: string }> {
		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(rawEmail);
		EmailSecurityUtil.enforceRateLimit(
			`panel_forgot:${tenantSlug || tenantId}:${cleanEmail}`,
			3,
			15 * 60 * 1000,
			15 * 60 * 1000
		);

		const StoreOwnerModel = connectionManager.getStoreOwnerModel();
		const owner = await StoreOwnerModel.findOne({ tenantId, email: cleanEmail, isActive: true });
		if (owner) {
			const { rawToken, tokenHash, expiresAt } = EmailSecurityUtil.generateResetToken(15);
			await StoreOwnerModel.updateOne(
				{ _id: owner._id },
				{ $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpiresAt: expiresAt } }
			);

			const panelBase = (process.env.PANEL_URL || 'https://panel.vexx.com.ar').replace(/\/+$/, '');
			const resetUrl = `${panelBase}/reset-password?token=${rawToken}&tenant=${encodeURIComponent(tenantSlug || '')}&scope=admin`;
			await ResendService.sendPasswordResetEmail({
				email: cleanEmail,
				recipientName: owner.name,
				resetUrl,
				rawToken,
				models
			});
		}

		return {
			success: true,
			message: 'Si el correo pertenece al dueño de esta tienda, te enviamos un enlace para restablecer la contraseña.'
		};
	}

	static async resetAdminPassword(params: {
		tenantId: string;
		token: string;
		newPassword: string;
		email?: string;
	}): Promise<{ success: boolean; message: string }> {
		const rawToken = String(params.token || '').trim();
		const newPassword = String(params.newPassword || '');
		if (!rawToken || newPassword.length < 6) {
			throw new AppError(
				'Validation Error',
				'El token es obligatorio y la nueva contraseña debe tener al menos 6 caracteres.',
				400
			);
		}

		const tokenHash = EmailSecurityUtil.hashToken(rawToken);
		const query: Record<string, unknown> = {
			tenantId: params.tenantId,
			resetPasswordTokenHash: tokenHash,
			resetPasswordExpiresAt: { $gt: new Date() },
			isActive: true
		};
		if (params.email) {
			query.email = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		}

		const StoreOwnerModel = connectionManager.getStoreOwnerModel();
		const owner = await StoreOwnerModel.findOne(query).select('+resetPasswordTokenHash +resetPasswordExpiresAt');
		if (!owner) {
			throw new AppError('Invalid or expired token', 'El enlace de recuperación es inválido o venció.', 400);
		}

		owner.password = newPassword;
		owner.resetPasswordTokenHash = undefined;
		owner.resetPasswordExpiresAt = undefined;
		owner.tokenVersion = (owner.tokenVersion || 0) + 1;
		await owner.save();

		return {
			success: true,
			message: 'Contraseña actualizada correctamente. Todas las sesiones anteriores fueron cerradas.'
		};
	}
}
