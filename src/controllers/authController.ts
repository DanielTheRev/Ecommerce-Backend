import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser, Role } from '../models/User';
import { OAuth2Client } from 'google-auth-library';
import { AdminUsers, IAdminUser } from '../models/AdminUser';

const CLIENT_ID = '454689294878-lkugek83r3g7ot0vurcpumoc1rr8fd66.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

interface AuthRequest extends Request {
	user?: IUser;
}

const cookieOptions = {
	expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
	httpOnly: true,
	secure: true,
	// sameSite: 'strict' as const
	sameSite: 'none' as const
};

// Función para generar JWT
const generateToken = (userID: string): string => {
	return jwt.sign({ userID }, process.env.JWT_SECRET!, {
		expiresIn: '7d'
	});
};

// Función para enviar respuesta con token
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
	const token = generateToken(user!._id as string);
	return res
		.status(statusCode)
		.cookie('token', token, cookieOptions)
		.json({
			success: true,
			message: statusCode === 201 ? 'Usuario registrado exitosamente' : 'Login exitoso',
			user: _userData
		});
};

// Función para traer los datos según el token de google
async function verify(token: string) {
	const ticket = await client.verifyIdToken({
		idToken: token,
		audience: CLIENT_ID
	});
	const payload = ticket.getPayload();
	return payload;
}

// @desc    Iniciar sesión con google
// @route   POST /api/auth/login/google
// @access  Public
export const loginUserWithGoogle = async (req: Request, res: Response) => {
	const { token, role } = req.body as { token: string; role: Role };
	if (!token)
		return res.status(401).json({
			success: false,
			message: 'Token no proporcionado'
		});
	const userData = await verify(token);

	if (!userData)
		return res.status(401).json({
			success: false,
			message: 'Token inválido'
		});

	console.log(userData);
	const { name, email, sub: googleID, picture } = userData;

	// Verificar si el usuario ya existe
	const existingUser = await User.findOne({ googleID, email });
	if (existingUser) {
		return sendTokenResponse(200, res, existingUser);
	}

	// Crear usuario
	const user = await User.create({
		name,
		email,
		role: role || Role.user,
		googleID,
		profilePhoto: picture,
		isActive: true
	});
	await user.save();

	return sendTokenResponse(201, res, user);
};

export const LoginAdmin = async (req: Request, res: Response) => {
	const data = req.body as { email: string; password: string };
	const { email, password } = data;
	const admin = await AdminUsers.findOne({ email });
	if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
	const isMatch = await admin.comparePassword(password);
	if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
	return sendTokenResponse(200, res, undefined, admin);
};

// @desc    Obtener usuario actual
// @route   GET /api/auth/me
// @access  Private
// export const getCurrentUser = async (req: AuthRequest, res: Response) => {
// 	try {
// 		const user = req.user;

// 		if (!user) {
// 			return res.status(401).json({
// 				success: false,
// 				message: 'Usuario no autenticado'
// 			});
// 		}

// 		return res.status(200).json({
// 			success: true,
// 			data: {
// 				user: {
// 					id: user._id,
// 					name: user.name,
// 					email: user.email,
// 					role: user.role,
// 					isActive: user.isActive,
// 					createdAt: user.createdAt,
// 					updatedAt: user.updatedAt
// 				}
// 			}
// 		});
// 	} catch (error) {
// 		console.error('Error obteniendo usuario:', error);
// 		return res.status(500).json({
// 			success: false,
// 			message: 'Error interno del servidor'
// 		});
// 	}
// };

export const getUserProfile = async (req: Request, res: Response) => {
	const { token: token } = req.cookies as { token: string };

	console.log('getUserProfile');
	console.log(token);

	if (!token) return res.status(401).json({ message: 'no token provided' });
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userID: string };
		const user = await User.findById(decoded.userID).select([
			'name',
			'email',
			'role',
			'profilePhoto'
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
		res.cookie('token', 'none', cookieOptions);

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
