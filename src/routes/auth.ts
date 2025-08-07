import { Router } from 'express';
import { getUserProfile, loginUserWithGoogle, logout } from '../controllers/authController';

const router: Router = Router();

// Rutas públicas
router.post('/login/google', loginUserWithGoogle);
router.post('/logout', logout);
router.get('/getUser', getUserProfile);

// Rutas protegidas
// router.get('/me', protect, getCurrentUser);

export default router;
