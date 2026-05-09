import { Router } from 'express';
import { adminOnly, protect } from '../middleware/auth';
import { UserController } from '../controllers/user.controller';

const router: Router = Router();

// GET /api/users/clients - Obtener todos los clientes registrados (solo admin)
router.get('/clients', protect, adminOnly, UserController.getAllClients);

export default router;
