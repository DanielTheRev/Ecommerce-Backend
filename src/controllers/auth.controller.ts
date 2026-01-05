import { AuthService } from '@/services/auth.service';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { IUser, IAdminUser, Role } from '@/interfaces/user.interface';
import { UserService } from '@/services/user.service';
import { AuthProvider } from '@/interfaces/auth.interface';

/* Function to send response with token */
const sendTokenResponse = (
	statusCode: number,
	res: Response,
	user?: IUser,
	userAdmin?: IAdminUser
) => {
	const _user = {
		id: user?._id,
		name: user?.name,
		email: user?.email,
		role: user?.role,
		isActive: user?.isActive,
		createdAt: user?.createdAt,
		updatedAt: user?.updatedAt
	};
	const _userAdmin = {
		id: userAdmin?._id,
		name: userAdmin?.name,
		email: userAdmin?.email,
		role: userAdmin?.role
	};

	const _userData = userAdmin ? _userAdmin : _user;
	const token = AuthService.generateToken(_userData!.id as string);
	const cookiePath = userAdmin ? 'token_a' : 'token_c';
	console.log(cookiePath);
	return res
		.status(statusCode)
		.cookie(cookiePath, token, AuthService.cookieOptions)
		.json({
			success: true,
			message: statusCode === 201 ? 'Usuario registrado exitosamente' : 'Login exitoso',
			user: _userData
		});
};

// @desc    Iniciar sesión con google
// @route   POST /api/auth/login/google
// @access  Public
export const loginUserWithGoogle = async (req: Request, res: Response, next: NextFunction) => {
	const { token, role } = req.body as { token: string; role: Role };

	try {
		const user = await AuthService.loginUserWith(AuthProvider.GOOGLE, token, role);
		return sendTokenResponse(201, res, user as unknown as IUser);
	} catch (error) {
		return next(error);
	}
};

export const LoginAdmin = async (req: Request, res: Response, next: NextFunction) => {
	const data = req.body as { email: string; password: string };
	const { email, password } = data;
	try {
		const user = await AuthService.loginUserWith(AuthProvider.Email, undefined, Role.admin, {
			email,
			password
		});
		const tempUser = user as unknown as IAdminUser;
		return sendTokenResponse(200, res, undefined, tempUser);
	} catch (error) {
		return next(error);
	}
};
// @desc get user profile
// @route GET /api/auth/getUser
export const getUserProfile = async (req: Request, res: Response) => {
	const { token_c: token } = req.cookies as { token_c: string };

	if (!token) return res.status(401).json({ message: 'no token provided' });
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userID: string };
		const user = await UserService.getUserByID(decoded.userID, [
			'name',
			'email',
			'role',
			'profilePhoto'
		]);
		if (!user) return res.status(404).json({ message: 'User not found' });
		return res.json({ ...user?.toJSON(), token });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ valid: false });
	}
};

// @desc get admin user profile
// @route GET /api/auth/getAdminUser
export const getAdminUserProfile = async (req: Request, res: Response) => {
	const { token_a: token } = req.cookies as { token_a: string };
	console.log(req.cookies);

	if (!token) return res.status(401).json({ message: 'no token provided' });
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userID: string };
		const user = await UserService.getAdminUserByID(decoded.userID, [
			'name',
			'email',
			'role',
			'profilePhoto',
			'token'
		]);
		return res.json({ user });
	} catch (error) {
		console.log(error);
		return res.status(401).json({ valid: false });
	}
};

// @desc    Cerrar sesión
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req: Request, res: Response) => {
	try {
		res.cookie('token_c', 'none', AuthService.cookieOptions);

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
