import { AppError } from '@/errors/app.error';
import { IUser, Role } from '@/interfaces/user.interface';
import { TenantModels } from '@/config/modelRegistry';

export class UserService {
	static async getUserByGoogleID(models: TenantModels, id: string) {
		try {
			const user = (await models.User.findOne({ googleID: id }).lean()) as any as IUser;
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

	static async getUserByID(models: TenantModels, id: string) {
		try {
			const user = (await models.User.findById(id).lean()) as any as IUser;
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

	static async getUserByEmail(models: TenantModels, email: string) {
		try {
			const user = await models.User.findOne({ email }).select('+password').exec();
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

	static async createUser(models: TenantModels, userData: Partial<IUser>) {
		try {
			const user = await models.User.create({
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
	static async getOrCreateGenericUser(models: TenantModels) {
		try {
			// Find existing generic user
			const genericUser = await models.User.findOne({ email: 'ventas@local.com' });
			if (genericUser) return genericUser;

			// If it doesn't exist, create it
			const newUser = await models.User.create({
				name: 'Consumidor Final',
				email: 'ventas@local.com',
				role: Role.user,
				isActive: true
			});

			return newUser;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error getting or creating generic user',
				'Error al intentar obtener o crear el usuario genérico',
				500
			);
		}
	}
}
