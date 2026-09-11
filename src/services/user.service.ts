import { AppError } from '@/errors/app.error';
import { IUser, Role } from '@/interfaces/user.interface';
import { TenantModels } from '@/config/modelRegistry';

const defaultRewards = {
	firstPurchaseEligible: true,
	firstPurchaseUsed: false,
	newsletterSubscribed: false,
	newsletterSubscribedAt: null,
	newsletterUsed: false,
	instagramClaimed: false,
	instagramUsed: false
};

export class UserService {
	static async getUserByGoogleID(models: TenantModels, id: string) {
		try {
			const user = (await models.User.findOne({ googleID: id }).lean()) as any as IUser;
			if (user && !user.rewards) {
				user.rewards = { ...defaultRewards };
			}
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
			if (!user.rewards) {
				user.rewards = { ...defaultRewards };
			}
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
			if (!user.rewards) {
				user.rewards = { ...defaultRewards };
			}
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
				lastName: userData.lastName || '',
				dni: userData.dni || '',
				phone: userData.phone || '',
				email: userData.email,
				role: userData.role || Role.user,
				googleID: userData.googleID,
				profilePhoto: userData.profilePhoto,
				rewards: userData.rewards || { ...defaultRewards },
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

	static async updateUserProfile(models: TenantModels, userId: string, data: { name?: string; lastName?: string; dni?: string; phone?: string }) {
		try {
			const user = await models.User.findById(userId);
			if (!user) throw new AppError('User not found', 'Usuario no encontrado', 404);

			if (data.name !== undefined) user.name = data.name.trim();
			if (data.lastName !== undefined) user.lastName = data.lastName.trim();
			if (data.dni !== undefined) user.dni = data.dni.trim();
			if (data.phone !== undefined) user.phone = data.phone.trim();

			await user.save();
			return user;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error updating profile',
				'Error al actualizar el perfil de usuario',
				500
			);
		}
	}

	static async getAllClients(models: TenantModels, page: number, limit: number, q?: string) {
		try {
			const skip = (page - 1) * limit;

			const filter: Record<string, any> = {
				role: Role.user,
				email: { $ne: 'ventas@local.com' }
			};

			if (q) {
				filter.$or = [
					{ name: { $regex: q, $options: 'i' } },
					{ email: { $regex: q, $options: 'i' } }
				];
			}

			const [clients, total] = await Promise.all([
				models.User.find(filter)
					.select('-password')
					.sort({ createdAt: -1 })
					.skip(skip)
					.limit(limit)
					.lean(),
				models.User.countDocuments(filter)
			]);

			return {
				data: clients,
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.ceil(total / limit)
				}
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error retrieving clients',
				'Error al intentar obtener los clientes',
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
				rewards: { ...defaultRewards },
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

	/* ========================================================== */
	/*             GESTIÓN DE EMPLEADOS / PERSONAL                */
	/* ========================================================== */

	static async getStaffMembers(
		models: TenantModels,
		query?: { search?: string; role?: string; isActive?: boolean }
	) {
		try {
			const filter: Record<string, any> = {
				role: { $in: [Role.admin, Role.employee] },
				email: { $ne: 'ventas@local.com' }
			};

			if (query?.role && (query.role === Role.admin || query.role === Role.employee)) {
				filter.role = query.role;
			}

			if (query?.isActive !== undefined) {
				filter.isActive = query.isActive;
			}

			if (query?.search) {
				const regex = { $regex: query.search.trim(), $options: 'i' };
				filter.$or = [
					{ name: regex },
					{ lastName: regex },
					{ email: regex },
					{ phone: regex },
					{ position: regex }
				];
			}

			const staff = await models.User.find(filter)
				.select('+pinCode')
				.sort({ createdAt: -1 })
				.lean();

			return staff.map((u: any) => ({
				_id: u._id,
				name: u.name,
				lastName: u.lastName || '',
				dni: u.dni || '',
				phone: u.phone || '',
				email: u.email,
				role: u.role,
				position: u.position || (u.role === Role.admin ? 'Administrador' : 'Cajero'),
				isActive: u.isActive !== false,
				hasPin: Boolean(u.pinCode),
				createdAt: u.createdAt,
				updatedAt: u.updatedAt
			}));
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error fetching staff members', 'Error al obtener la lista de empleados', 500);
		}
	}

	static async getStaffMemberById(models: TenantModels, id: string) {
		try {
			const user = (await models.User.findOne({
				_id: id,
				role: { $in: [Role.admin, Role.employee] }
			})
				.select('+pinCode')
				.lean()) as any;

			if (!user) {
				throw new AppError('Staff member not found', 'Empleado no encontrado', 404);
			}

			return {
				_id: user._id,
				name: user.name,
				lastName: user.lastName || '',
				dni: user.dni || '',
				phone: user.phone || '',
				email: user.email,
				role: user.role,
				position: user.position || (user.role === Role.admin ? 'Administrador' : 'Cajero'),
				isActive: user.isActive !== false,
				hasPin: Boolean(user.pinCode),
				createdAt: user.createdAt,
				updatedAt: user.updatedAt
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error getting staff member', 'Error al obtener datos del empleado', 500);
		}
	}

	static async createStaffMember(
		models: TenantModels,
		data: {
			name: string;
			lastName?: string;
			dni?: string;
			phone?: string;
			email: string;
			password: string;
			role?: Role;
			position?: string;
			pinCode?: string;
		}
	) {
		try {
			const cleanEmail = data.email.toLowerCase().trim();
			const existingUser = await models.User.findOne({ email: cleanEmail });
			if (existingUser) {
				throw new AppError(
					'Email already registered',
					'Ya existe un usuario registrado con este correo electrónico',
					400
				);
			}

			if (!data.password || data.password.length < 6) {
				throw new AppError(
					'Password too short',
					'La contraseña debe tener al menos 6 caracteres',
					400
				);
			}

			if (data.pinCode && !/^\d{4,6}$/.test(data.pinCode)) {
				throw new AppError(
					'Invalid PIN code',
					'El PIN de mostrador debe contener entre 4 y 6 dígitos numéricos',
					400
				);
			}

			const role = data.role === Role.admin ? Role.admin : Role.employee;
			const position = data.position?.trim() || (role === Role.admin ? 'Administrador' : 'Cajero');

			const newStaff = new models.User({
				name: data.name.trim(),
				lastName: data.lastName?.trim() || '',
				dni: data.dni?.trim() || '',
				phone: data.phone?.trim() || '',
				email: cleanEmail,
				password: data.password,
				role,
				position,
				pinCode: data.pinCode || null,
				isActive: true,
				rewards: { ...defaultRewards }
			});

			await newStaff.save();

			return {
				_id: newStaff._id,
				name: newStaff.name,
				lastName: newStaff.lastName,
				dni: newStaff.dni,
				phone: newStaff.phone,
				email: newStaff.email,
				role: newStaff.role,
				position: newStaff.position,
				isActive: newStaff.isActive,
				hasPin: Boolean(data.pinCode),
				createdAt: newStaff.createdAt,
				updatedAt: newStaff.updatedAt
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error creating staff member', 'Error al dar de alta al empleado', 500);
		}
	}

	static async updateStaffMember(
		models: TenantModels,
		id: string,
		data: {
			name?: string;
			lastName?: string;
			dni?: string;
			phone?: string;
			email?: string;
			password?: string;
			role?: Role;
			position?: string;
			pinCode?: string;
			isActive?: boolean;
		},
		currentUserId?: string
	) {
		try {
			const staff = await models.User.findOne({
				_id: id,
				role: { $in: [Role.admin, Role.employee] }
			}).select('+pinCode +password');

			if (!staff) {
				throw new AppError('Staff member not found', 'Empleado no encontrado', 404);
			}

			// Validar unicidad de email si cambió
			if (data.email) {
				const cleanEmail = data.email.toLowerCase().trim();
				if (cleanEmail !== staff.email) {
					const emailInUse = await models.User.findOne({ email: cleanEmail, _id: { $ne: id } });
					if (emailInUse) {
						throw new AppError(
							'Email already registered',
							'El correo electrónico ya está en uso por otro usuario',
							400
						);
					}
					staff.email = cleanEmail;
				}
			}

			// Proteger al último admin activo
			if (staff.role === Role.admin) {
				const willDemoteOrDeactivate =
					(data.role && data.role !== Role.admin) || (data.isActive === false && staff.isActive);

				if (willDemoteOrDeactivate) {
					const otherActiveAdmins = await models.User.countDocuments({
						role: Role.admin,
						isActive: true,
						_id: { $ne: id }
					});
					if (otherActiveAdmins === 0) {
						throw new AppError(
							'Cannot demote last admin',
							'No se puede desactivar ni quitar el rol al único administrador del comercio',
							400
						);
					}
				}
			}

			if (data.name !== undefined) staff.name = data.name.trim();
			if (data.lastName !== undefined) staff.lastName = data.lastName.trim();
			if (data.dni !== undefined) staff.dni = data.dni.trim();
			if (data.phone !== undefined) staff.phone = data.phone.trim();
			if (data.position !== undefined) staff.position = data.position.trim();
			if (data.isActive !== undefined) staff.isActive = data.isActive;

			if (data.role && (data.role === Role.admin || data.role === Role.employee)) {
				staff.role = data.role;
			}

			if (data.password) {
				if (data.password.length < 6) {
					throw new AppError(
						'Password too short',
						'La nueva contraseña debe tener al menos 6 caracteres',
						400
					);
				}
				staff.password = data.password;
			}

			if (data.pinCode !== undefined) {
				if (data.pinCode === '' || data.pinCode === null) {
					staff.pinCode = undefined;
				} else {
					if (!/^\d{4,6}$/.test(data.pinCode)) {
						throw new AppError(
							'Invalid PIN code',
							'El PIN de mostrador debe contener entre 4 y 6 dígitos numéricos',
							400
						);
					}
					staff.pinCode = data.pinCode;
				}
			}

			await staff.save();

			return {
				_id: staff._id,
				name: staff.name,
				lastName: staff.lastName,
				dni: staff.dni,
				phone: staff.phone,
				email: staff.email,
				role: staff.role,
				position: staff.position,
				isActive: staff.isActive,
				hasPin: Boolean(staff.pinCode),
				createdAt: staff.createdAt,
				updatedAt: staff.updatedAt
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error updating staff member', 'Error al actualizar datos del empleado', 500);
		}
	}

	static async toggleStaffStatus(models: TenantModels, id: string, currentUserId?: string) {
		try {
			if (currentUserId && String(id) === String(currentUserId)) {
				throw new AppError(
					'Cannot deactivate oneself',
					'No podés desactivar tu propia cuenta mientras estás conectado',
					400
				);
			}

			const staff = await models.User.findOne({
				_id: id,
				role: { $in: [Role.admin, Role.employee] }
			});

			if (!staff) {
				throw new AppError('Staff member not found', 'Empleado no encontrado', 404);
			}

			if (staff.role === Role.admin && staff.isActive) {
				const otherActiveAdmins = await models.User.countDocuments({
					role: Role.admin,
					isActive: true,
					_id: { $ne: id }
				});
				if (otherActiveAdmins === 0) {
					throw new AppError(
						'Cannot deactivate last admin',
						'No podés desactivar al único administrador activo del comercio',
						400
					);
				}
			}

			staff.isActive = !staff.isActive;
			await staff.save();

			return {
				_id: staff._id,
				isActive: staff.isActive,
				message: staff.isActive
					? 'Empleado activado exitosamente'
					: 'Empleado suspendido/revocado exitosamente'
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error toggling staff status', 'Error al cambiar estado del empleado', 500);
		}
	}

	static async deleteStaffMember(models: TenantModels, id: string, currentUserId?: string) {
		try {
			if (currentUserId && String(id) === String(currentUserId)) {
				throw new AppError(
					'Cannot delete oneself',
					'No podés eliminar tu propia cuenta mientras estás conectado',
					400
				);
			}

			const staff = await models.User.findOne({
				_id: id,
				role: { $in: [Role.admin, Role.employee] }
			});

			if (!staff) {
				throw new AppError('Staff member not found', 'Empleado no encontrado', 404);
			}

			if (staff.role === Role.admin) {
				const otherActiveAdmins = await models.User.countDocuments({
					role: Role.admin,
					isActive: true,
					_id: { $ne: id }
				});
				if (otherActiveAdmins === 0) {
					throw new AppError(
						'Cannot delete last admin',
						'No se puede eliminar al único administrador del comercio',
						400
					);
				}
			}

			await models.User.findByIdAndDelete(id);

			return {
				success: true,
				message: 'Empleado eliminado del sistema exitosamente'
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error deleting staff member', 'Error al eliminar el empleado', 500);
		}
	}

	static async verifyStaffPin(models: TenantModels, pinCode: string, staffId?: string) {
		try {
			if (!pinCode || pinCode.trim().length < 4) {
				throw new AppError('Invalid PIN', 'El PIN ingresado no es válido', 400);
			}

			// Si se especifica el ID de un empleado específico
			if (staffId) {
				const staff = await models.User.findOne({
					_id: staffId,
					role: { $in: [Role.admin, Role.employee] },
					isActive: true
				}).select('+pinCode');

				if (!staff || !staff.pinCode) {
					return { valid: false, message: 'Usuario no encontrado o no tiene PIN configurado' };
				}

				const isMatch = await staff.comparePin!(pinCode);
				if (!isMatch) {
					return { valid: false, message: 'PIN incorrecto' };
				}

				return {
					valid: true,
					user: {
						_id: staff._id,
						name: staff.name,
						lastName: staff.lastName || '',
						role: staff.role,
						position: staff.position || 'Cajero'
					}
				};
			}

			// Desbloqueo rápido de mostrador: buscar entre todos los empleados activos quién tiene este PIN
			const allStaffWithPin = await models.User.find({
				role: { $in: [Role.admin, Role.employee] },
				isActive: true,
				pinCode: { $exists: true, $ne: null }
			}).select('+pinCode');

			for (const staff of allStaffWithPin) {
				if (await staff.comparePin!(pinCode)) {
					return {
						valid: true,
						user: {
							_id: staff._id,
							name: staff.name,
							lastName: staff.lastName || '',
							role: staff.role,
							position: staff.position || 'Cajero'
						}
					};
				}
			}

			return { valid: false, message: 'PIN no encontrado o inválido' };
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error verifying PIN', 'Error al validar el PIN de mostrador', 500);
		}
	}
}
