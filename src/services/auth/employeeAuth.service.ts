import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { AuthError } from '@/errors/auth.error';
import { ISecureUser, IUser, Role } from '@/interfaces/user.interface';
import { EmailSecurityUtil } from '@/utils/emailSecurity.util';
import { ResendService } from '@/services/resend.service';
import { PanelAuthService } from './panelAuth.service';

export class EmployeeAuthService {
	/**
	 * Login de Empleado con Email + Contraseña propia (app Android o navegador).
	 * Aislado exclusivamente a `role: Role.employee`.
	 */
	static async loginEmployee(
		models: TenantModels,
		params: { email: string; password: string; tenantSlug?: string }
	): Promise<ISecureUser> {
		if (!params.email || !params.password) {
			throw new AuthError('Missing credentials', 'Ingresá tu email y contraseña.', 400);
		}

		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		EmailSecurityUtil.enforceRateLimit(
			`employee_login:${params.tenantSlug || ''}:${cleanEmail}`,
			10,
			15 * 60 * 1000,
			15 * 60 * 1000,
			'Demasiados intentos fallidos. Esperá 15 minutos.'
		);

		const user = await models.User.findOne({ email: cleanEmail, role: Role.employee }).select('+password');
		if (!user || !(await user.comparePassword(params.password))) {
			throw new AuthError('Invalid credentials', 'Credenciales inválidas.', 401);
		}

		if (user.isActive === false) {
			throw new AuthError('Account suspended', 'Tu cuenta de empleado se encuentra suspendida.', 403);
		}

		EmailSecurityUtil.clearRateLimit(`employee_login:${params.tenantSlug || ''}:${cleanEmail}`);
		user.lastLoginAt = new Date();
		await user.save();

		return PanelAuthService.sanitizeStaffUser(user.toObject() as unknown as IUser);
	}

	/**
	 * Cambio rápido de cajero en Mostrador POS mediante PIN numérico.
	 * Emite una sesión real recortada al `role: employee` y sus permisos granulares.
	 */
	static async loginWithPin(
		models: TenantModels,
		params: { employeeId?: string; email?: string; pin: string; tenantSlug?: string }
	): Promise<ISecureUser> {
		const pin = String(params.pin || '').trim();
		if (!pin || pin.length < 4 || pin.length > 8) {
			throw new AppError('Invalid PIN', 'El PIN debe tener entre 4 y 8 dígitos.', 400);
		}

		const rateKey = `pin_login:${params.tenantSlug || ''}:${params.employeeId || params.email || 'unknown'}`;
		EmailSecurityUtil.enforceRateLimit(
			rateKey,
			5,
			15 * 60 * 1000,
			15 * 60 * 1000,
			'PIN bloqueado temporalmente por demasiados intentos fallidos.'
		);

		const filter: Record<string, unknown> = { role: Role.employee, isActive: true };
		if (params.employeeId) {
			filter._id = params.employeeId;
		} else if (params.email) {
			filter.email = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		}

		let matchedEmployee: any = null;
		if (params.employeeId || params.email) {
			const candidate = await models.User.findOne(filter).select('+pinCode');
			if (candidate && candidate.comparePin && (await candidate.comparePin(pin))) {
				matchedEmployee = candidate;
			}
		} else {
			// Si solo se envió el PIN en mostrador, buscar entre los empleados activos con PIN configurado
			const candidates = await models.User.find({
				role: Role.employee,
				isActive: true,
				pinCode: { $ne: null }
			}).select('+pinCode');
			for (const c of candidates) {
				if (c.comparePin && (await c.comparePin(pin))) {
					matchedEmployee = c;
					break;
				}
			}
		}

		if (!matchedEmployee) {
			throw new AuthError('Invalid PIN', 'PIN incorrecto o empleado inactivo.', 401);
		}

		EmailSecurityUtil.clearRateLimit(rateKey);
		matchedEmployee.lastLoginAt = new Date();
		await matchedEmployee.save();

		return PanelAuthService.sanitizeStaffUser(matchedEmployee.toObject() as unknown as IUser);
	}

	static async forgotEmployeePassword(
		models: TenantModels,
		rawEmail: unknown,
		tenantSlug?: string
	): Promise<{ success: boolean; message: string }> {
		const cleanEmail = EmailSecurityUtil.normalizeAndValidateEmail(rawEmail);
		EmailSecurityUtil.enforceRateLimit(`employee_forgot:${tenantSlug || ''}:${cleanEmail}`, 3, 15 * 60 * 1000);

		const user = await models.User.findOne({ email: cleanEmail, role: Role.employee, isActive: true });
		if (user) {
			const { rawToken, tokenHash, expiresAt } = EmailSecurityUtil.generateResetToken(15);
			await models.User.updateOne(
				{ _id: user._id },
				{ $set: { resetPasswordTokenHash: tokenHash, resetPasswordExpiresAt: expiresAt } }
			);

			const panelBase = (process.env.PANEL_URL || 'https://panel.vexx.com.ar').replace(/\/+$/, '');
			const resetUrl = `${panelBase}/reset-password?token=${rawToken}&tenant=${encodeURIComponent(tenantSlug || '')}&scope=employee`;
			await ResendService.sendPasswordResetEmail({
				email: cleanEmail,
				recipientName: user.name,
				resetUrl,
				rawToken,
				models
			});
		}

		return {
			success: true,
			message: 'Si el correo corresponde a un empleado activo, te enviamos un enlace para restablecer la contraseña.'
		};
	}

	static async resetEmployeePassword(
		models: TenantModels,
		params: { token: string; newPassword: string; email?: string }
	): Promise<{ success: boolean; message: string }> {
		const rawToken = String(params.token || '').trim();
		const newPassword = String(params.newPassword || '');
		if (!rawToken || newPassword.length < 6) {
			throw new AppError('Validation Error', 'El token es obligatorio y la nueva contraseña debe tener al menos 6 caracteres.', 400);
		}

		const tokenHash = EmailSecurityUtil.hashToken(rawToken);
		const query: Record<string, unknown> = {
			role: Role.employee,
			resetPasswordTokenHash: tokenHash,
			resetPasswordExpiresAt: { $gt: new Date() },
			isActive: true
		};
		if (params.email) {
			query.email = EmailSecurityUtil.normalizeAndValidateEmail(params.email);
		}

		const user = await models.User.findOne(query).select('+resetPasswordTokenHash +resetPasswordExpiresAt');
		if (!user) {
			throw new AppError('Invalid or expired token', 'El enlace de recuperación es inválido o venció.', 400);
		}

		user.password = newPassword;
		user.resetPasswordTokenHash = undefined;
		user.resetPasswordExpiresAt = undefined;
		user.tokenVersion = (user.tokenVersion || 0) + 1;
		await user.save();

		return {
			success: true,
			message: 'Contraseña de empleado actualizada correctamente.'
		};
	}
}
