import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { AuthError } from '@/errors/auth.error';
import { AuthProvider } from '@/interfaces/auth.interface';
import { ISecureUser, IUser, Role } from '@/interfaces/user.interface';
import { EmailSecurityUtil } from '@/utils/emailSecurity.util';
import { EcommerceService } from '@/services/ecommerce.service';
import { ResendService } from '@/services/resend.service';

export const STOREFRONT_TOKEN_AUDIENCE = 'vexx_storefront';
export const STOREFRONT_COOKIE_NAME = 'vexx_store_token';

export class StorefrontAuthService {
	private static readonly DEFAULT_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

	static getCookieOptions() {
		const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
		return {
			expires: new Date(Date.now() + maxAgeMs),
			maxAge: maxAgeMs,
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax'
		};
	}

	static generateStorefrontToken(
		user: Pick<IUser, '_id' | 'role' | 'tokenVersion'>,
		tenantSlug?: string
	): string {
		const jwtSecret = process.env.JWT_SECRET;
		if (!jwtSecret) {
			throw new AppError('Server configuration error', 'Falta JWT_SECRET en el servidor.', 500);
		}
		return jwt.sign(
			{
				userID: String(user._id),
				tenantSlug,
				role: Role.user,
				tokenVersion: user.tokenVersion ?? 0
			},
			jwtSecret,
			{
				audience: STOREFRONT_TOKEN_AUDIENCE,
				expiresIn: '7d'
			}
		);
	}

	private static sanitizeCustomer(user: IUser): ISecureUser {
		return {
			_id: String(user._id),
			name: user.name,
			lastName: user.lastName,
			dni: user.dni,
			phone: user.phone,
			email: user.email,
			role: user.role,
			googleID: user.googleID,
			profilePhoto: user.profilePhoto,
			isEmailVerified: user.isEmailVerified,
			rewards: user.rewards,
			tokenVersion: user.tokenVersion ?? 0,
			lastLoginAt: user.lastLoginAt,
			isActive: user.isActive,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		};
	}

	private static async getTenantAuthConfig(models: TenantModels) {
		try {
			const config = await EcommerceService.getConfig(models);
			return {
				allowGoogle: config.authConfig?.allowGoogle ?? true,
				allowMagicCode: config.authConfig?.allowMagicCode ?? true,
				allowEmailPassword: config.authConfig?.allowEmailPassword ?? true,
				googleClientId: config.integrations?.googleAuth?.clientId || this.DEFAULT_GOOGLE_CLIENT_ID
			};
		} catch {
			return {
				allowGoogle: true,
				allowMagicCode: true,
				allowEmailPassword: true,
				googleClientId: this.DEFAULT_GOOGLE_CLIENT_ID
			};
		}
	}

	private static async verifyGoogleIdToken(idToken: string, googleClientId?: string) {
		if (!googleClientId) {
			throw new AppError('Google Auth not configured', 'Falta configurar Google Client ID para esta tienda.', 500);
		}
		try {
			const client = new OAuth2Client(googleClientId);
			const ticket = await client.verifyIdToken({
				idToken,
				audience: googleClientId
			});
			const payload = ticket.getPayload();
			if (!payload || !payload.email) {
				throw new AuthError('Invalid Google token', 'Token de Google inválido.', 401);
			}
			return payload;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AuthError('Google authentication failed', 'Error al verificar sesión con Google.', 401);
		}
	}

	/**
	 * Login exclusivo de Compradores Públicos (Role.user) con Google o Email+Contraseña.
	 */
	static async loginCustomerWith(
		models: TenantModels,
		provider: AuthProvider,
		googleToken?: string,
		loginData?: { email?: string; password?: string },
		tenantSlug?: string
	): Promise<ISecureUser> {
		const authCfg = await this.getTenantAuthConfig(models);

		if (provider === AuthProvider.GOOGLE) {
			if (!authCfg.allowGoogle) {
				throw new AppError('Auth method disabled', 'El inicio de sesión con Google está deshabilitado en esta tienda.', 403);
			}
			if (!googleToken) {
				throw new AppError('Missing token', 'No se proporcionó el token de Google.', 400);
			}
			const payload = await this.verifyGoogleIdToken(googleToken, authCfg.googleClientId);
			const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(payload.email);

			// Verificar que el correo no pertenezca a una cuenta administrativa de esta tienda
			const staffConflict = await models.User.findOne({
				email: cleanEmail,
				role: { $in: [Role.admin, Role.employee] }
			}).lean();
			if (staffConflict) {
				throw new AppError(
					'Staff account restricted',
					'Este correo pertenece a una cuenta administrativa del panel. Usá otro correo para comprar en la tienda.',
					403
				);
			}

			let user = await models.User.findOne({
				$or: [{ googleID: payload.sub }, { email: cleanEmail }],
				role: Role.user
			});

			const isNewsletterSubscribed = await models.Newsletter.exists({ email: cleanEmail });

			if (user) {
				if (user.isActive === false) {
					throw new AuthError('Account suspended', 'Tu cuenta se encuentra suspendida.', 403);
				}
				if (!user.googleID && payload.sub) {
					user.googleID = payload.sub;
				}
				if (payload.picture && !user.profilePhoto) {
					user.profilePhoto = payload.picture;
				}
				if (isNewsletterSubscribed && !user.rewards?.newsletterSubscribed) {
					user.rewards = {
						...(user.rewards || { firstPurchaseEligible: true, instagramClaimed: false }),
						newsletterSubscribed: true,
						newsletterSubscribedAt: new Date()
					};
				}
				user.isEmailVerified = true;
				user.lastLoginAt = new Date();
				await user.save();
				return this.sanitizeCustomer(user.toObject() as unknown as IUser);
			}

			const created = await models.User.create({
				name: payload.name || cleanEmail.split('@')[0],
				email: cleanEmail,
				role: Role.user,
				googleID: payload.sub,
				profilePhoto: payload.picture,
				isEmailVerified: true,
				rewards: {
					firstPurchaseEligible: true,
					newsletterSubscribed: Boolean(isNewsletterSubscribed),
					newsletterSubscribedAt: isNewsletterSubscribed ? new Date() : null,
					instagramClaimed: false
				},
				lastLoginAt: new Date(),
				isActive: true
			});

			return this.sanitizeCustomer(created.toObject() as unknown as IUser);
		}

		if (provider === AuthProvider.Email) {
			if (!authCfg.allowEmailPassword) {
				throw new AppError('Auth method disabled', 'El inicio de sesión con contraseña está deshabilitado en esta tienda.', 403);
			}
			if (!loginData?.email || !loginData?.password) {
				throw new AuthError('Missing credentials', 'Ingresá tu email y contraseña.', 400);
			}

			const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(loginData.email);
			EmailSecurityUtil.enforceRateLimit(
				`storefront_login:${tenantSlug || ''}:${cleanEmail}`,
				10,
				15 * 60 * 1000,
				15 * 60 * 1000,
				'Demasiados intentos fallidos. Esperá 15 minutos.'
			);

			const user = await models.User.findOne({ email: cleanEmail, role: Role.user }).select('+password');
			if (!user || !(await user.comparePassword(loginData.password))) {
				throw new AuthError('Invalid credentials', 'Credenciales inválidas.', 401);
			}
			if (user.isActive === false) {
				throw new AuthError('Account suspended', 'Tu cuenta se encuentra suspendida.', 403);
			}

			EmailSecurityUtil.clearRateLimit(`storefront_login:${tenantSlug || ''}:${cleanEmail}`);
			user.lastLoginAt = new Date();
			await user.save();
			return this.sanitizeCustomer(user.toObject() as unknown as IUser);
		}

		throw new AppError('Unsupported provider', 'Proveedor de autenticación no soportado.', 400);
	}

	/**
	 * Registro de comprador público con Email + Contraseña (Role.user).
	 */
	static async registerCustomer(
		models: TenantModels,
		params: { name: string; lastName?: string; email: string; password: string; dni?: string; phone?: string },
		tenantSlug?: string
	): Promise<ISecureUser> {
		const authCfg = await this.getTenantAuthConfig(models);
		if (!authCfg.allowEmailPassword) {
			throw new AppError('Auth method disabled', 'El registro con contraseña está deshabilitado en esta tienda.', 403);
		}

		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		if (!params.name || !params.name.trim()) {
			throw new AppError('Validation Error', 'El nombre es obligatorio.', 400);
		}
		if (!params.password || params.password.length < 6) {
			throw new AppError('Validation Error', 'La contraseña debe tener al menos 6 caracteres.', 400);
		}

		EmailSecurityUtil.enforceRateLimit(`storefront_reg:${tenantSlug || ''}:${cleanEmail}`, 5, 15 * 60 * 1000);

		const existing = await models.User.findOne({ email: cleanEmail }).lean();
		if (existing) {
			throw new AppError('Email already registered', 'Ya existe una cuenta registrada con este correo.', 409);
		}

		const isNewsletterSubscribed = await models.Newsletter.exists({ email: cleanEmail });
		const created = await models.User.create({
			name: params.name.trim(),
			lastName: params.lastName?.trim() || '',
			dni: params.dni?.trim() || '',
			phone: params.phone?.trim() || '',
			email: cleanEmail,
			password: params.password,
			role: Role.user,
			rewards: {
				firstPurchaseEligible: true,
				newsletterSubscribed: Boolean(isNewsletterSubscribed),
				newsletterSubscribedAt: isNewsletterSubscribed ? new Date() : null,
				instagramClaimed: false
			},
			lastLoginAt: new Date(),
			isActive: true
		});

		return this.sanitizeCustomer(created.toObject() as unknown as IUser);
	}

	private static hashOtpCode(code: string): string {
		const secret = process.env.JWT_SECRET;
		if (!secret) throw new AppError('Missing JWT_SECRET', 'Falta JWT_SECRET en el servidor.', 500);
		return crypto.createHash('sha256').update(`${code}:${secret}`).digest('hex');
	}

	static async sendOtp(
		models: TenantModels,
		rawEmail: string,
		userData?: { name?: string; lastName?: string; dni?: string },
		tenantSlug?: string,
		clientIp = 'unknown'
	) {
		const authCfg = await this.getTenantAuthConfig(models);
		if (!authCfg.allowMagicCode) {
			throw new AppError('Auth method disabled', 'El acceso por código único está deshabilitado en esta tienda.', 403);
		}

		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(rawEmail);
		EmailSecurityUtil.enforceRateLimit(
			`otp_send:${tenantSlug || ''}:${cleanEmail}`,
			3,
			5 * 60 * 1000,
			10 * 60 * 1000,
			'Ya enviamos varios códigos a este correo. Esperá unos minutos.'
		);
		EmailSecurityUtil.enforceRateLimit(`otp_send_ip:${tenantSlug || ''}:${clientIp}`, 12, 10 * 60 * 1000);

		const existingAny = await models.User.findOne({ email: cleanEmail }).lean();
		if (existingAny && existingAny.role !== Role.user) {
			throw new AppError(
				'Staff account restricted',
				'Este correo pertenece a una cuenta administrativa del panel. Usá otro correo para ingresar a la tienda.',
				403
			);
		}

		const isNewUser = !existingAny;
		if (isNewUser && (!userData?.name || !userData.name.trim())) {
			throw new AppError('Name required', 'Por favor ingresá tu nombre para registrarte.', 400);
		}

		const code = crypto.randomInt(100000, 1000000).toString();
		const codeHash = this.hashOtpCode(code);

		const otpToken = jwt.sign(
			{
				email: cleanEmail,
				codeHash,
				isNewUser,
				name: userData?.name?.trim() || '',
				lastName: userData?.lastName?.trim() || '',
				dni: userData?.dni?.trim() || '',
				tenantSlug: tenantSlug ? tenantSlug.trim().toLowerCase() : ''
			},
			process.env.JWT_SECRET!,
			{ audience: 'vexx_storefront_otp', expiresIn: '10m' }
		);

		await ResendService.sendOtpEmail(cleanEmail, code, models);

		return {
			success: true,
			message: 'Código de acceso enviado a tu correo.',
			otpToken,
			isNewUser
		};
	}

	static async verifyOtp(
		models: TenantModels,
		otpToken: string,
		submittedCode: string,
		expectedTenantSlug?: string
	): Promise<ISecureUser> {
		if (!otpToken || !submittedCode) {
			throw new AppError('Missing token or code', 'Ingresá el código de 6 dígitos enviado a tu correo.', 400);
		}

		let decoded: any;
		try {
			decoded = jwt.verify(otpToken, process.env.JWT_SECRET!, { audience: 'vexx_storefront_otp' });
		} catch {
			throw new AppError('Invalid or expired token', 'El código venció o es inválido. Solicitá uno nuevo.', 400);
		}

		if (decoded.tenantSlug && expectedTenantSlug && decoded.tenantSlug.toLowerCase() !== expectedTenantSlug.trim().toLowerCase()) {
			throw new AppError('Tenant mismatch', 'Este código de acceso no corresponde a esta tienda.', 403);
		}

		const email = EmailSecurityUtil.normalizeAndValidateEmail(decoded.email);
		const attemptKey = `otp_verify:${decoded.tenantSlug || ''}:${email}`;
		const cleanSubmitted = submittedCode.trim().replace(/\s+/g, '');
		const expectedHash = this.hashOtpCode(cleanSubmitted);

		if (decoded.codeHash !== expectedHash) {
			EmailSecurityUtil.enforceRateLimit(
				attemptKey,
				5,
				15 * 60 * 1000,
				15 * 60 * 1000,
				'Demasiados intentos fallidos. Código bloqueado por 15 minutos.'
			);
			throw new AppError('Incorrect code', 'Código incorrecto. Revisá tu correo e intentá nuevamente.', 400);
		}

		EmailSecurityUtil.clearRateLimit(attemptKey);

		let user = await models.User.findOne({ email, role: Role.user });
		if (!user) {
			const isNewsletterSubscribed = await models.Newsletter.exists({ email });
			user = await models.User.create({
				name: decoded.name || email.split('@')[0],
				lastName: decoded.lastName || '',
				dni: decoded.dni || '',
				email,
				role: Role.user,
				isEmailVerified: true,
				rewards: {
					firstPurchaseEligible: true,
					newsletterSubscribed: Boolean(isNewsletterSubscribed),
					newsletterSubscribedAt: isNewsletterSubscribed ? new Date() : null,
					instagramClaimed: false
				},
				lastLoginAt: new Date(),
				isActive: true
			});
		} else {
			if (user.isActive === false) {
				throw new AuthError('Account suspended', 'Tu cuenta se encuentra suspendida.', 403);
			}
			user.isEmailVerified = true;
			user.lastLoginAt = new Date();
			await user.save();
		}

		return this.sanitizeCustomer(user.toObject() as unknown as IUser);
	}

	static async forgotCustomerPassword(
		models: TenantModels,
		rawEmail: unknown,
		tenantSlug?: string,
		storefrontOrigin?: string
	): Promise<{ success: boolean; message: string }> {
		const authCfg = await this.getTenantAuthConfig(models);
		if (!authCfg.allowEmailPassword) {
			throw new AppError('Auth method disabled', 'La recuperación por contraseña no está habilitada en esta tienda.', 403);
		}

		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(rawEmail);
		EmailSecurityUtil.enforceRateLimit(`storefront_forgot:${tenantSlug || ''}:${cleanEmail}`, 3, 15 * 60 * 1000);

		const user = await models.User.findOne({ email: cleanEmail, role: Role.user, isActive: true });
		if (user) {
			const { rawToken, tokenHash, expiresAt } = EmailSecurityUtil.generateResetToken(15);
			await models.User.updateOne(
				{ _id: user._id },
				{ $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpiresAt: expiresAt } }
			);

			const baseDomain = (process.env.VEXX_BASE_DOMAIN || 'vexx.com.ar').trim().toLowerCase();
			const baseUrl = (storefrontOrigin || `https://${tenantSlug || 'tienda'}.${baseDomain}`).replace(/\/+$/, '');
			const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
			await ResendService.sendPasswordResetEmail({
				email: cleanEmail,
				recipientName: user.name,
				resetUrl,
				rawToken,
				models
			});
		}

		return {
			success: true,
			message: 'Si el correo está registrado en la tienda, te enviamos las instrucciones para restablecer tu contraseña.'
		};
	}

	static async resetCustomerPassword(
		models: TenantModels,
		params: { token: string; newPassword: string; email?: string }
	): Promise<{ success: boolean; message: string }> {
		const rawToken = String(params.token || '').trim();
		const newPassword = String(params.newPassword || '');
		if (!rawToken || newPassword.length < 6) {
			throw new AppError('Validation Error', 'El token es obligatorio y la nueva contraseña debe tener al menos 6 caracteres.', 400);
		}

		const tokenHash = EmailSecurityUtil.hashToken(rawToken);
		const query: Record<string, unknown> = {
			role: Role.user,
			resetPasswordTokenHash: tokenHash,
			resetPasswordExpiresAt: { $gt: new Date() },
			isActive: true
		};
		if (params.email) {
			query.email = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		}

		const user = await models.User.findOne(query).select('+resetPasswordTokenHash +resetPasswordExpiresAt');
		if (!user) {
			throw new AppError('Invalid or expired token', 'El enlace de recuperación es inválido o venció.', 400);
		}

		user.password = newPassword;
		user.isEmailVerified = true;
		user.resetPasswordTokenHash = undefined;
		user.resetPasswordExpiresAt = undefined;
		user.tokenVersion = (user.tokenVersion || 0) + 1;
		await user.save();

		return {
			success: true,
			message: 'Contraseña actualizada correctamente. Ya podés iniciar sesión en la tienda.'
		};
	}
}
