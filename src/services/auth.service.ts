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

			const user = await UserService.getUserByGoogleID(models, googleID);
			/* user already registered with google */
			if (user) return user;

			const newUserData = {
				name,
				email,
				role,
				googleID,
				profilePhoto: picture,
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
				isActive: user.isActive,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt
			};
			return userFlat;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Authentication failed', 'Error al intentar iniciar sesión', 500);
		}
	}
}
