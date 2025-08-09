import { Router } from 'express';
import { getUserProfile, loginUserWithGoogle, logout, LoginAdmin, getAdminUserProfile } from '../controllers/authController';

const router: Router = Router();

// Rutas públicas
router.post('/login/google', loginUserWithGoogle);
router.post('/login/admin', LoginAdmin);
router.post('/logout', logout);
router.get('/getUser', getUserProfile);
router.get('/getAdminUser', getAdminUserProfile);

// Rutas protegidas
// router.get('/me', protect, getCurrentUser);

export default router;
