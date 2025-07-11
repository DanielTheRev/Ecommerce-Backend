import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';

interface AuthRequest extends Request {
  user?: IUser;
}

// Función para generar JWT
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, {
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
    sameSite: 'strict' as const
  };

  return res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      message: statusCode === 201 ? 'Usuario registrado exitosamente' : 'Login exitoso',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
};

// @desc    Registrar usuario
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    // Validación de campos requeridos
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, proporciona nombre, email y contraseña'
      });
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con este email'
      });
    }

    // Crear usuario
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'user'
    });

    return sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Iniciar sesión
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validación de campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, proporciona email y contraseña'
      });
    }

    // Buscar usuario e incluir password para comparación
    const user = await User.findOne({ email, isActive: true }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    return sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// @desc    Obtener usuario actual
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
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
