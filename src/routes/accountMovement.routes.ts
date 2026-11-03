import { Router } from 'express';
import { AccountMovementController } from '@/controllers/accountMovement.controller';
import { protect, staffOnly } from '@/middleware/auth';

const router: Router = Router();

// Todas las operaciones de cuenta corriente requieren usuario autenticado de tienda (admin o empleado/cajero)
router.use(protect);
router.use(staffOnly);

// Resumen de deudores ("Plata en la calle")
router.get('/debtors', AccountMovementController.getDebtors);

// Ficha de cuenta corriente y movimientos de un cliente
router.get('/clients/:id', AccountMovementController.getClientAccount);

// Registrar cobro / entrega a cuenta
router.post('/clients/:id/payments', AccountMovementController.recordPayment);

// Registrar ajuste de saldo manual
router.post('/clients/:id/adjustments', AccountMovementController.recordAdjustment);

// Configuración de crédito (límite y permiso de fiar)
router.patch('/clients/:id/credit-config', AccountMovementController.updateCreditConfig);

// Link de recordatorio WhatsApp
router.get('/clients/:id/whatsapp-reminder', AccountMovementController.getWhatsAppReminder);

export default router;
