import { AuthError } from '@/errors/auth.error';
import { AuthProvider } from '@/interfaces/auth.interface';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { UserService } from './user.service';
import { Role } from '@/interfaces/user.interface';
import { AppError } from '@/errors/app.error';
import dotenv from 'dotenv';

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
	}

	static generateToken(userID: string): string {
		return jwt.sign({ userID }, process.env.JWT_SECRET!, {
			expiresIn: '7d'
		});
	}

	static async loginUserWith(
		provider: AuthProvider,
		token?: string,
		role?: Role,
		loginData?: { email: string; password: string }
	) {
		// Implement login logic based on provider
		if (provider === AuthProvider.GOOGLE) return this.loginWithGoogle(token!, role!);
		if (provider === AuthProvider.Email) return this.loginWithEmail(loginData!, role!);
		throw new AppError('Unsupported authentication provider', 400);
	}

	private static async loginWithGoogle(token: string, role: Role) {
		// Validate token
		if (!token) throw new AuthError('No token provided', 401);
		// try to get user data from google token
		try {
			const userData = await AuthService.getDataFromGoogleToken(token);
			if (!userData) {
				throw new AuthError('Invalid Google token or no user valid', 401);
			}
			const { name = '', email = '', sub: googleID, picture = '' } = userData;

			const existingUser = await UserService.getUserByGoogleID(googleID);
			if (existingUser) return existingUser;

			const newUserData = {
				name,
				email,
				role: role || Role.user,
				googleID,
				profilePhoto: picture,
				isActive: true,
				token
			};
			const newUser = await UserService.createUser(newUserData, token);
			return newUser;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Authentication failed', 500);
		}
	}

	private static async loginWithEmail(loginData: { email: string; password: string }, role: Role) {
		if (!loginData.email || !loginData.password) {
			throw new AuthError('Missing email or password', 400);
		}
		// for now, only admin can login with Email
		if (role === Role.admin) {
			try {
				const admin = await UserService.getAdminUserByEmail(loginData.email);
				if (!admin) {
					throw new AuthError('Invalid credentials', 401);
				}
				const isMatch = await admin.comparePassword(loginData.password);
				if (!isMatch) {
					throw new AuthError('Invalid credentials', 401);
				}
				const tempUser = {
					_id: admin._id,
					name: admin.name,
					email: admin.email,
					role: admin.role
				} as any;
				admin.token = AuthService.generateToken(admin._id as string);
				await admin.save();
				return tempUser;
			} catch (error) {
				if (error instanceof AppError) throw error;
				throw new AppError('Authentication failed', 500);
			}
		}
		throw new AppError('login error', 401);
	}
}
