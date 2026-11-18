import { Router } from 'express';
import {
	changeAdminPassword,
	forgotAdminPassword,
	forgotCustomerPassword,
	forgotEmployeePassword,
	getAdminProfile,
	getUserProfile,
	LoginAdmin,
	loginEmployee,
	loginEmployeeWithPin,
	loginUser,
	logout,
	registerUser,
	resetAdminPassword,
	resetCustomerPassword,
	resetEmployeePassword,
	sendOtp,
	updateAdminProfile,
	verifyOtp
} from '../controllers/auth.controller';
import { adminOnly, protect, staffOnly } from '@/middleware/auth';

const router: Router = Router();

// 1. Storefront Público (Compradores — Role.user)
router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotCustomerPassword);
router.post('/reset-password', resetCustomerPassword);

// 2. Panel de Administración (Dueño — StoreOwner en master_db)
router.post('/admin/login', LoginAdmin);
router.post('/admin/forgot-password', forgotAdminPassword);
router.post('/admin/reset-password', resetAdminPassword);
router.get('/admin/me', protect, adminOnly, getAdminProfile);
router.patch('/admin/me', protect, adminOnly, updateAdminProfile);
router.put('/admin/password', protect, adminOnly, changeAdminPassword);

// 3. Empleados & Mostrador POS (Role.employee)
router.post('/employee/login', loginEmployee);
router.post('/employee/pin-login', protect, staffOnly, loginEmployeeWithPin);
router.post('/employee/forgot-password', forgotEmployeePassword);
router.post('/employee/reset-password', resetEmployeePassword);

// 4. Sesión activa y Logout
router.post('/logout', logout);
router.get('/getUser', protect, getUserProfile);

export default router;
