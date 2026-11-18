import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '@/errors/app.error';
import { AuthProvider, ILoginUserWithGoogle } from '@/interfaces/auth.interface';
import { ISecureUser, IUser, Role } from '@/interfaces/user.interface';
import { AuthRequest } from '@/middleware/auth';
import { validateTenantSubscriptionIntegrity } from '@/middleware/planGuard';
import {
	PANEL_COOKIE_NAME,
	PanelAuthService
} from '@/services/auth/panelAuth.service';
import { EmployeeAuthService } from '@/services/auth/employeeAuth.service';
import {
	STOREFRONT_COOKIE_NAME,
	StorefrontAuthService
} from '@/services/auth/storefrontAuth.service';
import { UserService } from '@/services/user.service';

const sendPanelTokenResponse = (
	statusCode: number,
	res: Response,
	user: ISecureUser,
	tenantSlug?: string,
	rememberMe = false
) => {
	if (!user) throw new AppError('SendTokenResponseError', 'Usuario no encontrado', 401);
	const token = PanelAuthService.generatePanelToken(user as unknown as IUser, tenantSlug, rememberMe);
	return res
		.status(statusCode)
		.cookie(PANEL_COOKIE_NAME, token, PanelAuthService.getCookieOptions(rememberMe))
		.json({
			success: true,
			message: 'Login exitoso',
			user,
			tenantSlug,
			token
		});
};

const sendStorefrontTokenResponse = (
	statusCode: number,
	res: Response,
	user: ISecureUser,
	tenantSlug?: string
) => {
	if (!user) throw new AppError('SendTokenResponseError', 'Usuario no encontrado', 401);
	const token = StorefrontAuthService.generateStorefrontToken(user as unknown as IUser, tenantSlug);
	return res
		.status(statusCode)
		.cookie(STOREFRONT_COOKIE_NAME, token, StorefrontAuthService.getCookieOptions())
		.json({
			success: true,
			message: statusCode === 201 ? 'Usuario registrado exitosamente' : 'Login exitoso',
			user,
			tenantSlug,
			token
		});
};

// ============================================================================
// 1. COMPRADORES DE TIENDA PÚBLICA (StorefrontAuthService — Role.user)
// ============================================================================

export const loginUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { provider, token: googleToken, email, password } = req.body as ILoginUserWithGoogle;
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const user = await StorefrontAuthService.loginCustomerWith(
			req.models!,
			provider,
			googleToken,
			{ email, password },
			req.tenant?.slug
		);
		return sendStorefrontTokenResponse(200, res, user, req.tenant?.slug);
	} catch (error) {
		return next(error);
	}
};

export const registerUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const user = await StorefrontAuthService.registerCustomer(req.models!, req.body || {}, req.tenant?.slug);
		return sendStorefrontTokenResponse(201, res, user, req.tenant?.slug);
	} catch (error) {
		return next(error);
	}
};

export const sendOtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { email, name, lastName, dni } = req.body || {};
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const result = await StorefrontAuthService.sendOtp(
			req.models!,
			email,
			{ name, lastName, dni },
			req.tenant?.slug,
			req.ip
		);
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

export const verifyOtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { otpToken, code } = req.body || {};
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const user = await StorefrontAuthService.verifyOtp(req.models!, otpToken, code, req.tenant?.slug);
		return sendStorefrontTokenResponse(200, res, user, req.tenant?.slug);
	} catch (error) {
		return next(error);
	}
};

export const forgotCustomerPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const result = await StorefrontAuthService.forgotCustomerPassword(
			req.models!,
			req.body?.email,
			req.tenant?.slug,
			req.headers.origin
		);
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

export const resetCustomerPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const { token, newPassword, email } = req.body || {};
		const result = await StorefrontAuthService.resetCustomerPassword(req.models!, { token, newPassword, email });
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

// ============================================================================
// 2. ADMINISTRADOR / DUEÑO DEL COMERCIO (PanelAuthService — StoreOwner en master_db)
// ============================================================================

export const LoginAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { email, password, tenantSlug, businessName, storeName, rememberMe } = (req.body || {}) as {
		email: string;
		password: string;
		tenantSlug?: string;
		businessName?: string;
		storeName?: string;
		rememberMe?: boolean;
	};

	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const tenantId = req.tenant?._id ? String(req.tenant._id) : '';
		const effectiveSlug = req.tenant?.slug || tenantSlug || storeName || businessName;
		const user = await PanelAuthService.loginAdmin({
			tenantId,
			email,
			password,
			tenantSlug: effectiveSlug
		});

		return sendPanelTokenResponse(200, res, user, effectiveSlug, Boolean(rememberMe));
	} catch (error) {
		return next(error);
	}
};

export const forgotAdminPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const tenantId = req.tenant?._id ? String(req.tenant._id) : '';
		const result = await PanelAuthService.forgotAdminPassword(req.models!, tenantId, req.body?.email, req.tenant?.slug);
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

export const resetAdminPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const tenantId = req.tenant?._id ? String(req.tenant._id) : '';
		const { token, newPassword, email } = req.body || {};
		const result = await PanelAuthService.resetAdminPassword({ tenantId, token, newPassword, email });
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

export const getAdminProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const ownerId = req.user?._id ? String(req.user._id) : '';
		const tenantId = req.tenant?._id ? String(req.tenant._id) : '';
		const user = await PanelAuthService.getOwnerProfile(ownerId, tenantId);
		return res.status(200).json({ success: true, user });
	} catch (error) {
		return next(error);
	}
};

export const updateAdminProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const ownerId = req.user?._id ? String(req.user._id) : '';
		const tenantId = req.tenant?._id ? String(req.tenant._id) : '';
		const { name, lastName, phone, dni, email, profilePhoto } = req.body || {};
		const result = await PanelAuthService.updateOwnerProfile(ownerId, tenantId, {
			name,
			lastName,
			phone,
			dni,
			email,
			profilePhoto
		});
		return res.status(200).json({
			success: true,
			message: result.emailChanged
				? 'Perfil actualizado. Como cambiaste tu email, volvé a iniciar sesión.'
				: 'Perfil actualizado correctamente.',
			...result
		});
	} catch (error) {
		return next(error);
	}
};

export const changeAdminPassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const ownerId = req.user?._id ? String(req.user._id) : '';
		const tenantId = req.tenant?._id ? String(req.tenant._id) : '';
		const { currentPassword, newPassword } = req.body || {};
		const result = await PanelAuthService.changeOwnerPassword(ownerId, tenantId, {
			currentPassword,
			newPassword
		});
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

// ============================================================================
// 3. EMPLEADOS & CAJEROS (EmployeeAuthService — Role.employee)
// ============================================================================

export const loginEmployee = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { email, password, tenantSlug, rememberMe } = req.body || {};
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const effectiveSlug = req.tenant?.slug || tenantSlug;
		const user = await EmployeeAuthService.loginEmployee(req.models!, {
			email,
			password,
			tenantSlug: effectiveSlug
		});
		return sendPanelTokenResponse(200, res, user, effectiveSlug, Boolean(rememberMe));
	} catch (error) {
		return next(error);
	}
};

export const loginEmployeeWithPin = async (req: AuthRequest, res: Response, next: NextFunction) => {
	const { employeeId, email, pin } = req.body || {};
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const user = await EmployeeAuthService.loginWithPin(req.models!, {
			employeeId,
			email,
			pin,
			tenantSlug: req.tenant?.slug
		});
		return sendPanelTokenResponse(200, res, user, req.tenant?.slug, false);
	} catch (error) {
		return next(error);
	}
};

export const forgotEmployeePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const result = await EmployeeAuthService.forgotEmployeePassword(req.models!, req.body?.email, req.tenant?.slug);
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

export const resetEmployeePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		validateTenantSubscriptionIntegrity(req.tenant);
		const { token, newPassword, email } = req.body || {};
		const result = await EmployeeAuthService.resetEmployeePassword(req.models!, { token, newPassword, email });
		return res.status(200).json(result);
	} catch (error) {
		return next(error);
	}
};

// ============================================================================
// 4. PERFIL ACTIVO Y LOGOUT
// ============================================================================

export const getUserProfile = async (req: AuthRequest, res: Response) => {
	if (req.user) {
		return res.json(req.user);
	}

	let token: string | undefined;
	const authHeader = req.headers.authorization;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		token = authHeader.split(' ')[1];
	} else if (req.cookies?.[STOREFRONT_COOKIE_NAME] && req.cookies[STOREFRONT_COOKIE_NAME] !== 'none') {
		token = req.cookies[STOREFRONT_COOKIE_NAME];
	} else if (req.cookies?.[PANEL_COOKIE_NAME] && req.cookies[PANEL_COOKIE_NAME] !== 'none') {
		token = req.cookies[PANEL_COOKIE_NAME];
	}

	if (!token) return res.status(401).json({ message: 'no token provided' });
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
			userID: string;
			tenantSlug?: string;
			aud?: string;
		};
		if (decoded.aud !== 'vexx_panel' && decoded.aud !== 'vexx_storefront') {
			return res.status(401).json({ message: 'Sesión obsoleta, volvé a iniciar sesión', valid: false });
		}
		if (decoded.tenantSlug && req.tenant?.slug && decoded.tenantSlug.toLowerCase() !== req.tenant.slug.toLowerCase()) {
			return res.status(403).json({ message: 'Sesión no corresponde a esta tienda', valid: false });
		}
		const user = await UserService.getUserByID(req.models!, decoded.userID);
		if (!user) return res.status(404).json({ message: 'User not found' });
		return res.json(user);
	} catch {
		return res.status(401).json({ valid: false });
	}
};

export const logout = async (req: AuthRequest, res: Response) => {
	const scope = String(req.body?.scope || req.query?.scope || 'all').toLowerCase();
	const clearOpts = {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax'
	};

	if (scope === 'all' || scope === 'panel') {
		res.clearCookie(PANEL_COOKIE_NAME, clearOpts);
	}
	if (scope === 'all' || scope === 'storefront') {
		res.clearCookie(STOREFRONT_COOKIE_NAME, clearOpts);
	}
	res.clearCookie('token_b', clearOpts);

	return res.status(200).json({
		success: true,
		message: 'Sesión cerrada exitosamente'
	});
};
