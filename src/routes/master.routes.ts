import { Router } from 'express';
import { MasterTenantController } from '@/controllers/masterTenant.controller';
import { requireSuperAdmin } from '@/middleware/masterAuth.middleware';

const router: Router = Router();

// Rutas públicas de autenticación Master
router.post('/auth/login', MasterTenantController.login);

// Rutas protegidas exclusivamente para SuperAdmin
router.get('/auth/me', requireSuperAdmin, MasterTenantController.getMe);

// Gestión de comercios
router.get('/tenants', requireSuperAdmin, MasterTenantController.getTenants);
router.post('/tenants', requireSuperAdmin, MasterTenantController.createTenant);
router.patch('/tenants/:id/status', requireSuperAdmin, MasterTenantController.toggleStatus);
router.patch('/tenants/:id/subscription', requireSuperAdmin, MasterTenantController.updateSubscription);
router.patch('/tenants/:id/plan', requireSuperAdmin, MasterTenantController.updatePlan);

export default router;
