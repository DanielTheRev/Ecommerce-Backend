import { TenantModels } from '@/config/modelRegistry';
import { EmployeePermission, DEFAULT_ROLE_PROFILES, IRoleProfile } from '@/interfaces/permission.interface';
import { AppError } from '@/errors/app.error';

export class RoleProfileService {
	/**
	 * Obtiene todos los perfiles de permisos configurados en la tienda.
	 * Modo Día 0: Si no tiene perfiles creados por el dueño, retorna array vacío.
	 */
	static async getProfiles(models: TenantModels) {
		return await models.RoleProfile.find().sort({ createdAt: 1 }).lean();
	}

	/**
	 * Crea un nuevo perfil personalizado de rol con alias y permisos elegidos por el dueño.
	 */
	static async createProfile(
		models: TenantModels,
		data: {
			name: string;
			description?: string;
			permissions: EmployeePermission[];
		}
	) {
		const cleanName = data.name?.trim();
		if (!cleanName) {
			throw new AppError(
				'Profile name required',
				'El nombre o alias del puesto es obligatorio (ej: "Chicos de Caja")',
				400
			);
		}

		const existing = await models.RoleProfile.findOne({
			name: { $regex: new RegExp(`^${cleanName}$`, 'i') }
		});
		if (existing) {
			throw new AppError(
				'Profile already exists',
				`Ya existe un perfil con el nombre '${cleanName}'`,
				400
			);
		}

		const newProfile = new models.RoleProfile({
			name: cleanName,
			description: data.description?.trim() || '',
			permissions: Array.isArray(data.permissions) ? data.permissions : [],
			isDefault: false
		});

		await newProfile.save();
		return newProfile.toObject();
	}

	/**
	 * Actualiza los permisos o nombre de un perfil de rol.
	 */
	static async updateProfile(
		models: TenantModels,
		id: string,
		data: {
			name?: string;
			description?: string;
			permissions?: EmployeePermission[];
		}
	) {
		const profile = await models.RoleProfile.findById(id);
		if (!profile) {
			throw new AppError('Profile not found', 'Perfil de permisos no encontrado', 404);
		}

		if (data.name && data.name.trim()) {
			profile.name = data.name.trim();
		}
		if (typeof data.description === 'string') {
			profile.description = data.description.trim();
		}
		if (Array.isArray(data.permissions)) {
			profile.permissions = data.permissions;
		}

		await profile.save();
		return profile.toObject();
	}

	/**
	 * Elimina un perfil personalizado.
	 * Protege perfiles que estén en uso activo por empleados.
	 */
	static async deleteProfile(models: TenantModels, id: string) {
		const profile = await models.RoleProfile.findById(id);
		if (!profile) {
			throw new AppError('Profile not found', 'Perfil de permisos no encontrado', 404);
		}

		// Verificar si algún empleado activo tiene asignado este perfil
		const assignedUsers = await models.User.countDocuments({ roleProfileId: id, isActive: true });
		if (assignedUsers > 0) {
			throw new AppError(
				'Profile in use',
				`No se puede eliminar el perfil porque está asignado a ${assignedUsers} empleado(s) activo(s). Reasigna los empleados primero.`,
				400
			);
		}

		await models.RoleProfile.findByIdAndDelete(id);
		return { success: true, message: 'Perfil de permisos eliminado correctamente' };
	}
}
