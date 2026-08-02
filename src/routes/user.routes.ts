import { Router } from 'express';
import { adminOnly, protect } from '../middleware/auth';
import { UserController } from '../controllers/user.controller';

const router: Router = Router();

// GET /api/users/me - Perfil del usuario actual
router.get('/me', protect, UserController.getMe);

// PUT /api/users/me - Actualizar nombre, apellido, DNI, teléfono
router.put('/me', protect, UserController.updateMe);

// GET /api/users/clients - Obtener todos los clientes registrados (solo admin)
router.get('/clients', protect, adminOnly, UserController.getAllClients);

export default router;
