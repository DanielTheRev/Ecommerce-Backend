import { Router } from 'express';
import { TenantBootstrapController } from '@/controllers/tenantBootstrap.controller';
import { protect } from '@/middleware/auth';

const router: Router = Router();

// Endpoint de arranque disponible para cualquier usuario autenticado de la tienda (Admin o Empleado)
router.get('/bootstrap', protect, TenantBootstrapController.getBootstrapData);

export default router;
