import express, { Router } from 'express';
import { register, login, logout, getCurrentUser } from '../controllers/authController'
import { protect } from '../middleware/auth';

const router: Router = Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Rutas protegidas
router.get('/me', protect, getCurrentUser);

export default router;
