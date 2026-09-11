import { AuthRequest } from '@/middleware/auth';
import { UserService } from '@/services/user.service';
import { NextFunction, Response } from 'express';

export class UserController {
	// GET /api/users/me - Obtener perfil del usuario autenticado
	static async getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user?._id;
			if (!userId) {
				res.status(401).json({ message: 'No autenticado' });
				return;
			}

			const user = await UserService.getUserByID(req.models!, String(userId));
			res.status(200).json(user);
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/users/me - Actualizar perfil (nombre, apellido, DNI, teléfono)
	static async updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user?._id;
			if (!userId) {
				res.status(401).json({ message: 'No autenticado' });
				return;
			}

			const { name, lastName, dni, phone } = req.body;
			const updatedUser = await UserService.updateUserProfile(req.models!, String(userId), {
				name,
				lastName,
				dni,
				phone
			});

			res.status(200).json(updatedUser);
		} catch (error) {
			next(error);
		}
	}

	// GET /api/users/clients - Obtener todos los clientes registrados (admin)
	static async getAllClients(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;
			const q = req.query.q as string | undefined;

			const result = await UserService.getAllClients(req.models!, page, limit, q);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	/* ========================================================== */
	/*             CONTROLADORES DE EMPLEADOS / STAFF             */
	/* ========================================================== */

	// GET /api/users/staff - Obtener lista de personal (admin)
	static async getStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { search, role, isActive } = req.query;
			const parsedIsActive = isActive !== undefined ? isActive === 'true' : undefined;

			const staff = await UserService.getStaffMembers(req.models!, {
				search: search as string,
				role: role as string,
				isActive: parsedIsActive
			});

			res.status(200).json({
				success: true,
				data: staff
			});
		} catch (error) {
			next(error);
		}
	}

	// GET /api/users/staff/:id - Obtener detalle de empleado (admin)
	static async getStaffById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const staff = await UserService.getStaffMemberById(req.models!, id);

			res.status(200).json({
				success: true,
				data: staff
			});
		} catch (error) {
			next(error);
		}
	}

	// POST /api/users/staff - Dar de alta a un empleado (admin)
	static async createStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { name, lastName, dni, phone, email, password, role, position, pinCode } = req.body;

			const newStaff = await UserService.createStaffMember(req.models!, {
				name,
				lastName,
				dni,
				phone,
				email,
				password,
				role,
				position,
				pinCode
			});

			res.status(201).json({
				success: true,
				message: 'Empleado creado exitosamente',
				data: newStaff
			});
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/users/staff/:id - Actualizar datos de un empleado (admin)
	static async updateStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const { name, lastName, dni, phone, email, password, role, position, pinCode, isActive } = req.body;

			const updatedStaff = await UserService.updateStaffMember(
				req.models!,
				id,
				{
					name,
					lastName,
					dni,
					phone,
					email,
					password,
					role,
					position,
					pinCode,
					isActive
				},
				req.user?._id ? String(req.user._id) : undefined
			);

			res.status(200).json({
				success: true,
				message: 'Empleado actualizado exitosamente',
				data: updatedStaff
			});
		} catch (error) {
			next(error);
		}
	}

	// PATCH /api/users/staff/:id/toggle-status - Activar / Revocar acceso de empleado (admin)
	static async toggleStaffStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const result = await UserService.toggleStaffStatus(
				req.models!,
				id,
				req.user?._id ? String(req.user._id) : undefined
			);

			res.status(200).json({
				success: true,
				...result
			});
		} catch (error) {
			next(error);
		}
	}

	// DELETE /api/users/staff/:id - Eliminar empleado (admin)
	static async deleteStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const result = await UserService.deleteStaffMember(
				req.models!,
				id,
				req.user?._id ? String(req.user._id) : undefined
			);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	// POST /api/users/staff/verify-pin - Validar PIN de mostrador para desbloqueo rápido
	static async verifyPin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { pinCode, staffId } = req.body;
			const result = await UserService.verifyStaffPin(req.models!, pinCode, staffId);

			if (!result.valid) {
				res.status(401).json({
					success: false,
					message: result.message || 'PIN incorrecto o inválido'
				});
				return;
			}

			res.status(200).json({
				success: true,
				user: result.user
			});
		} catch (error) {
			next(error);
		}
	}
}
