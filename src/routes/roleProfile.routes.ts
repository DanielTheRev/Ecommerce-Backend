import { Router } from 'express';
import { RoleProfileController } from '@/controllers/roleProfile.controller';
import { protect, adminOnly } from '@/middleware/auth';

const router: Router = Router();

// Todas las rutas de gestión de perfiles de rol requieren estar autenticado como Admin (Dueño)
router.use(protect);

// GET es accesible por staff para consultar qué perfiles existen al crear empleados
router.get('/', RoleProfileController.getProfiles);

// Mutaciones restringidas a Administrador
router.post('/', adminOnly, RoleProfileController.createProfile);
router.put('/:id', adminOnly, RoleProfileController.updateProfile);
router.delete('/:id', adminOnly, RoleProfileController.deleteProfile);

export default router;
