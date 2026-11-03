import { Router } from 'express';
import {
	closeRegister,
	getCurrentRegister,
	openRegister
} from '../controllers/cashRegister.controller';
import { adminOnly, protect } from '../middleware/auth';

const router: Router = Router();

// Todas las rutas de caja requieren autenticación y rol apropiado (ej. admin o employee autorizado)
router.post('/open', protect, adminOnly, openRegister);
router.get('/current', protect, adminOnly, getCurrentRegister);
router.post('/close', protect, adminOnly, closeRegister);

export default router;
