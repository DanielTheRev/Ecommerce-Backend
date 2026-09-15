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

/* ========================================================== */
/*             RUTAS DE EMPLEADOS / PERSONAL                  */
/* ========================================================== */

// GET /api/users/staff - Lista de personal del comercio (admin)
router.get('/staff', protect, adminOnly, UserController.getStaff);

// GET /api/users/staff/:id - Detalle de un empleado (admin)
router.get('/staff/:id', protect, adminOnly, UserController.getStaffById);

// POST /api/users/staff - Dar de alta empleado (admin)
router.post('/staff', protect, adminOnly, UserController.createStaff);

// PUT /api/users/staff/:id - Actualizar datos / resetear PIN / clave (admin)
router.put('/staff/:id', protect, adminOnly, UserController.updateStaff);

// PATCH /api/users/staff/:id/toggle-status - Suspender o activar empleado (admin)
router.patch('/staff/:id/toggle-status', protect, adminOnly, UserController.toggleStaffStatus);

// DELETE /api/users/staff/:id - Eliminar empleado (admin)
router.delete('/staff/:id', protect, adminOnly, UserController.deleteStaff);

// POST /api/users/staff/verify-pin - Validar PIN de mostrador (staff)
router.post('/staff/verify-pin', protect, UserController.verifyPin);

/* ========================================================== */
/*             NOTIFICACIONES PUSH MÓVILES (EXPO)             */
/* ========================================================== */

// POST /api/users/push-token - Registrar token de notificación móvil
router.post('/push-token', protect, UserController.registerPushToken);

// DELETE /api/users/push-token - Desvincular token de notificación móvil (logout)
router.delete('/push-token', protect, UserController.removePushToken);

export default router;
