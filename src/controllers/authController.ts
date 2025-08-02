import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser, Role } from '../models/User';
import { OAuth2Client } from 'google-auth-library';

const CLIENT_ID = '454689294878-lkugek83r3g7ot0vurcpumoc1rr8fd66.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

interface AuthRequest extends Request {
	user?: IUser;
}

// Función para generar JWT
const generateToken = (userID: string): string => {
	return jwt.sign({ userID }, process.env.JWT_SECRET!, {
		expiresIn: '7d'
	});
};

// Función para enviar respuesta con token
const sendTokenResponse = (user: IUser, statusCode: number, res: Response) => {
	const token = generateToken(user._id as string);

	// Opciones de cookie
	const options = {
		expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		// sameSite: 'strict' as const
		sameSite: "none" as const
	};

	return res
		.status(statusCode)
		.cookie('token', token, options)
		.json({
			success: true,
			message: statusCode === 201 ? 'Usuario registrado exitosamente' : 'Login exitoso',
			user: {
				id: user._id,
				name: user.name,
				email: user.email,
				role: user.role,
				isActive: user.isActive,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt
			}
		});
};

// Función para traer los datos según el token de google
async function verify(token: string) {
	const ticket = await client.verifyIdToken({
		idToken: token,
		audience: CLIENT_ID
	});
	const payload = ticket.getPayload();
	console.log(payload);
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

	const { name, email, sub: googleID, picture } = userData;

	// Verificar si el usuario ya existe
	const existingUser = await User.findOne({ googleID, email });
	if (existingUser) {
		return sendTokenResponse(existingUser, 200, res);
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

	return sendTokenResponse(user, 201, res);
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
		res.cookie('token', 'none', {
			expires: new Date(Date.now() + 10 * 1000), // 10 segundos
			httpOnly: true
		});

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
