import { AuthService } from '@/services/auth.service';
import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ISecureUser } from '@/interfaces/user.interface';
import { UserService } from '@/services/user.service';
import { AuthProvider, ILoginUserWithGoogle } from '@/interfaces/auth.interface';
import { AppError } from '@/errors/app.error';
import { AuthRequest } from '@/middleware/auth';

/* Function to send response with token */
const sendTokenResponse = (statusCode: number, res: Response, user: ISecureUser, tenantSlug?: string) => {
	if (!user) throw new AppError('SendTokenResponseError: Not found user', 'User not found', 401);

	const token = AuthService.generateToken(user._id, tenantSlug, user.role);
	const cookiePath = 'token_b';
	return res
		.status(statusCode)
		.cookie(cookiePath, token, AuthService.cookieOptions)
		.json({
			success: true,
			message: statusCode === 201 ? 'Usuario registrado exitosamente' : 'Login exitoso',
			user: user,
			tenantSlug: tenantSlug,
			token: token
		});
};

// @desc    Iniciar sesión con google
// @route   POST /api/auth/login/google
// @access  Public
export const loginUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { provider, token: googleToken, email, password } = req.body as ILoginUserWithGoogle;

	try {
		const user = await AuthService.loginUserWith(req.models!, provider, googleToken, {
			email,
			password
		});
		return sendTokenResponse(201, res, user as unknown as ISecureUser, req.tenant?.slug);
	} catch (error) {
		return next(error);
	}
};

export const LoginAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const data = req.body as { email: string; password: string; tenantSlug?: string };
	const { email, password } = data;

	try {
		const user = await AuthService.loginUserWith(req.models!, AuthProvider.Email, '', {
			email,
			password
		});
		return sendTokenResponse(200, res, user as ISecureUser, req.tenant?.slug || data.tenantSlug);
	} catch (error) {
		return next(error);
	}
};

// @desc get user profile
// @route GET /api/auth/getUser
export const getUserProfile = async (req: AuthRequest, res: Response) => {
	let token: string | undefined;
	const authHeader = req.headers.authorization;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		token = authHeader.split(' ')[1];
	} else if (req.cookies && req.cookies.token_b && req.cookies.token_b !== 'none') {
		token = req.cookies.token_b;
	}

	if (!token) return res.status(401).json({ message: 'no token provided' });
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userID: string; tenantSlug?: string };
		const user = await UserService.getUserByID(req.models!, decoded.userID);
		if (!user) return res.status(404).json({ message: 'User not found' });
		return res.json(user);
	} catch (error) {
		console.log(error);
		return res.status(401).json({ valid: false });
	}
};

// @desc    Cerrar sesión
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req: AuthRequest, res: Response) => {
	try {
		res.cookie('token_b', 'none', {
			...AuthService.cookieOptions,
			expires: new Date(0),
			maxAge: 0
		});
		res.clearCookie('token_b', AuthService.cookieOptions);

		return res.status(200).json({
			success: true,
			message: 'Sesión cerrada exitosamente'
		});
	} catch (error) {
		console.error('Error cerrando sesión:', error);
		return res.status(500).json({
			success: false,
			message: 'Error interno del servidor'
		});
	}
};

export const sendOtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { email, name, lastName, dni } = req.body;
	try {
		const result = await AuthService.sendOtp(req.models!, email, { name, lastName, dni });
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

export const verifyOtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { otpToken, code } = req.body;
	try {
		const user = await AuthService.verifyOtp(req.models!, otpToken, code);
		return sendTokenResponse(200, res, user as ISecureUser);
	} catch (error) {
		return next(error);
	}
};
