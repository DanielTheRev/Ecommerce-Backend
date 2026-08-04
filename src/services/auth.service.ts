import { AppError } from '@/errors/app.error';
import { AuthError } from '@/errors/auth.error';
import { AuthProvider } from '@/interfaces/auth.interface';
import { ISecureUser, Role } from '@/interfaces/user.interface';
import { TenantModels } from '@/config/modelRegistry';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { UserService } from './user.service';

dotenv.config();

export class AuthService {
	private static readonly CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
	static readonly cookieOptions = {
		expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
		httpOnly: true,
		secure: true,
		sameSite: process.env.NODE_ENV === 'production' ? ('strict' as const) : ('none' as const)
	};

	private static getGoogleClient() {
		if (!this.CLIENT_ID) {
			throw new Error('GOOGLE_CLIENT_ID is not defined');
		}
		const client = new OAuth2Client(this.CLIENT_ID);
		return client;
	}

	// get payload from Google token
	private static async getDataFromGoogleToken(token: string) {
		try {
			const client = this.getGoogleClient();
			const ticket = await client.verifyIdToken({
				idToken: token,
				audience: this.CLIENT_ID
			});
			const payload = ticket.getPayload();
			if (!payload) {
				throw new Error('Invalid Google token payload');
			}
			return payload;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('google token or implementation error', 'Usuario no encontrado', 500);
		}
	}

	static generateToken(userID: string): string {
		return jwt.sign({ userID }, process.env.JWT_SECRET!, {
			expiresIn: '7d'
		});
	}

	static async loginUserWith(
		models: TenantModels,
		provider: AuthProvider,
		token?: string,
		loginData?: { email: string; password: string }
	) {
		/* If is an user, role will be defined */
		const role = Role.user;
		// Implement login logic based on provider
		if (provider === AuthProvider.GOOGLE) return this.loginWithGoogle(models, role, token!);
		if (provider === AuthProvider.Email) return this.loginWithEmail(models, loginData!, role!);
		throw new AppError(
			'Unsupported authentication provider',
			'Proveedor de autenticación no soportado',
			400
		);
	}

	private static async loginWithGoogle(models: TenantModels, role: Role, googleToken: string) {
		if (!googleToken) throw new AppError('no token provided', 'No se proporcionó token', 500);
		try {
			const userData = await AuthService.getDataFromGoogleToken(googleToken);
			if (!userData) {
				throw new AuthError(
					'Invalid Google token or no user valid',
					'Token de google invalido o usuario no valido',
					401
				);
			}
			const { name, email, sub: googleID, picture } = userData;
			const userEmail = (email || '').toLowerCase();

			// Verificar si el correo ya figuraba en la lista de suscriptores del Newsletter
			const isNewsletterSubscribed = userEmail ? await models.Newsletter.exists({ email: userEmail }) : null;

			let user = await UserService.getUserByGoogleID(models, googleID);
			/* user already registered with google */
			if (user) {
				if (isNewsletterSubscribed && (!user.rewards || !user.rewards.newsletterSubscribed)) {
					await models.User.findByIdAndUpdate(user._id, {
						$set: {
							'rewards.newsletterSubscribed': true,
							'rewards.newsletterSubscribedAt': new Date()
						}
					});
					user = await UserService.getUserByID(models, String(user._id));
				}
				return user;
			}

			const newUserData = {
				name,
				email: userEmail,
				role,
				googleID,
				profilePhoto: picture,
				rewards: {
					firstPurchaseEligible: true,
					newsletterSubscribed: !!isNewsletterSubscribed,
					newsletterSubscribedAt: isNewsletterSubscribed ? new Date() : null,
					instagramClaimed: false
				},
				isActive: true
			};
			const newUser = await UserService.createUser(models, newUserData);
			return newUser;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Authentication failed', 'Error al intentar iniciar sesión', 500);
		}
	}

	private static async loginWithEmail(models: TenantModels, loginData: { email: string; password: string }, role: Role) {
		if (!loginData.email || !loginData.password) {
			throw new AuthError('Missing email or password', 'Faltan email o contraseña', 400);
		}
		try {
			const user = await UserService.getUserByEmail(models, loginData.email);
			if (!user) {
				throw new AuthError('Invalid credentials', 'Credenciales invalidas', 401);
			}
			const isMatch = await user.comparePassword(loginData.password);
			if (!isMatch) {
				throw new AuthError('Invalid credentials', 'Credenciales inválidas', 401);
			}
			const userFlat: ISecureUser = {
				_id: user._id as string,
				name: user.name,
				email: user.email,
				role: user.role,
				googleID: user.googleID,
				profilePhoto: user.profilePhoto,
				rewards: user.rewards,
				isActive: user.isActive,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt
			};
			return userFlat;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AuthError('Authentication failed', 'Error al intentar iniciar sesión', 500);
		}
	}

	static async sendOtp(
		models: TenantModels,
		email: string,
		userData?: { name?: string; lastName?: string; dni?: string }
	) {
		const cleanEmail = (email || '').trim().toLowerCase();
		if (!cleanEmail || !cleanEmail.includes('@')) {
			throw new AppError('Invalid email', 'Ingresá un correo electrónico válido', 400);
		}

		const existingUser = await models.User.findOne({ email: cleanEmail });
		const isNewUser = !existingUser;

		if (isNewUser && (!userData?.name || !userData.name.trim())) {
			throw new AppError('Name is required for registration', 'Por favor ingresá tu nombre para registrarte', 400);
		}

		const code = Math.floor(100000 + Math.random() * 900000).toString();

		const otpToken = jwt.sign(
			{
				email: cleanEmail,
				code,
				isNewUser,
				name: userData?.name?.trim() || '',
				lastName: userData?.lastName?.trim() || '',
				dni: userData?.dni?.trim() || ''
			},
			process.env.JWT_SECRET!,
			{ expiresIn: '10m' }
		);

		const { ResendService } = await import('./resend.service');
		await ResendService.sendOtpEmail(cleanEmail, code, models);

		return {
			success: true,
			message: 'Código de acceso enviado a tu correo',
			otpToken,
			isNewUser
		};
	}

	static async verifyOtp(
		models: TenantModels,
		otpToken: string,
		submittedCode: string
	) {
		if (!otpToken || !submittedCode) {
			throw new AppError('Missing token or code', 'Ingresá el código de 6 dígitos enviado a tu correo', 400);
		}

		let decoded: any;
		try {
			decoded = jwt.verify(otpToken, process.env.JWT_SECRET!);
		} catch (err) {
			throw new AppError('Invalid or expired token', 'El código venció o es inválido. Volvé a ingresar tu mail para recibir uno nuevo.', 400);
		}

		const cleanSubmitted = submittedCode.trim().replace(/\s+/g, '');
		if (decoded.code !== cleanSubmitted) {
			throw new AppError('Incorrect code', 'El código de 6 dígitos ingresado es incorrecto', 400);
		}

		const email = decoded.email;
		let user = await models.User.findOne({ email });

		if (!user) {
			const isNewsletterSubscribed = await models.Newsletter.exists({ email });

			const newUserData = {
				name: decoded.name || 'Cliente',
				lastName: decoded.lastName || '',
				dni: decoded.dni || '',
				email,
				role: Role.user,
				isEmailVerified: true,
				rewards: {
					firstPurchaseEligible: true,
					firstPurchaseUsed: false,
					newsletterSubscribed: !!isNewsletterSubscribed,
					newsletterSubscribedAt: isNewsletterSubscribed ? new Date() : null,
					newsletterUsed: false,
					instagramClaimed: false,
					instagramUsed: false
				},
				isActive: true
			};

			user = await UserService.createUser(models, newUserData as any);

			try {
				await models.Order.updateMany(
					{ 'buyerData.email': email, user: { $exists: false } },
					{ $set: { user: user._id } }
				);
			} catch (err) {
				console.error('Error linking past guest orders:', err);
			}
		} else {
			if (!user.isEmailVerified) {
				user.isEmailVerified = true;
				await user.save();
			}
		}

		const userFlat: ISecureUser = {
			_id: String(user._id),
			name: user.name,
			email: user.email,
			role: user.role,
			googleID: user.googleID,
			profilePhoto: user.profilePhoto,
			rewards: user.rewards,
			isActive: user.isActive,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		};

		return userFlat;
	}
}
