import { AppError } from '@/errors/app.error';
import { IUser, Role } from '@/interfaces/user.interface';

import { User } from '@/models/User.model';

export class UserService {
	static async getUserByGoogleID(id: string) {
		try {
			const user = (await User.findOne({ googleID: id }).lean()) as IUser;
			return user;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error retrieving user by Google ID',
				'Error al intentar recuperar el usuario por Google ID',
				500
			);
		}
	}

	static async getUserByID(id: string) {
		try {
			const user = (await User.findById(id).lean()) as IUser;
			if (!user) throw new AppError('User not found', 'Usuario no encontrado', 404);
			return user;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error trying to find user',
				'Error al intentar encontrar el usuario',
				500
			);
		}
	}

	static async getUserByEmail(email: string) {
		try {
			const user = await User.findOne({ email }).select('+password').exec();
			if (!user) throw new AppError('User not found', 'Usuario no encontrado', 404);
			return user;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error found trying get user',
				'Error al intentar recuperar el usuario',
				500
			);
		}
	}

	static async createUser(userData: Partial<IUser>) {
		try {
			const user = await User.create({
				name: userData.name,
				email: userData.email,
				role: userData.role || Role.user,
				googleID: userData.googleID,
				profilePhoto: userData.profilePhoto,
				isActive: true
			});
			return user;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error creating new user',
				'Error al intentar crear un nuevo usuario',
				500
			);
		}
	}
}
