import { Router } from 'express';
import { getUserProfile, LoginAdmin, loginUser, logout } from '../controllers/auth.controller';
import { protect } from '@/middleware/auth';

const router: Router = Router();

// Public routes
router.post('/login', loginUser);
router.post('/admin/login', LoginAdmin);
router.post('/logout', logout);
router.get('/getUser', protect, getUserProfile);
// router.get('/getAdminUser', getAdminUserProfile);

// Rutas protegidas
// router.get('/me', protect, getCurrentUser);

export default router;
