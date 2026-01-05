import { AppError } from '@/errors/app.error';
import { DatabaseError } from '@/errors/database.error';
import { IUser, Role } from '@/interfaces/user.interface';
import { AdminUsers } from '@/models/AdminUser.model';
import { User } from '@/models/User.model';

export class UserService {
	static async getUserByGoogleID(id: string) {
		try {
			const user = await User.findOne({ googleID: id });
			if (!user) {
				throw new AppError('User not found ', 404);
			}
			return user;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error retrieving user by Google ID', 500);
		}
	}

	static async getUserByID(id: string, selectedFields?: string[]) {
		try {
			const user = await User.findById(id).select(selectedFields || []);
			return user;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error trying to find user', 500);
		}
	}

	static async getAdminUserByEmail(email: string) {
		try {
			const admin = AdminUsers.findOne({ email });
			if (!admin) {
				throw new AppError('Admin user not found with the provided email', 404);
			}
			return admin;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error in UserService.getAdminUserByEmail trying to find admin', 500);
		}
	}

	static async getAdminUserByID(id: string, selectedFields?: string[]) {
		try {
			const admin = await AdminUsers.findById(id).select(selectedFields || []);
			if (!admin) {
				throw new AppError('Admin user not found with the provided ID', 404);
			}
			return admin;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error in UserService.getAdminUserByID trying to find admin by ID',
				500
			);
		}
	}

	static async createUser(userData: Partial<IUser>, token: string) {
		try {
			const user = await User.create({
				name: userData.name,
				email: userData.email,
				role: userData.role || Role.user,
				googleID: userData.googleID,
				profilePhoto: userData.profilePhoto,
				isActive: true,
				token
			});
			return user;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error creating new user', 500);
		}
	}
}
