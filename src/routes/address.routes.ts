import { Router } from 'express';
import { AddressController } from '../controllers/address.controller';
import { protect } from '../middleware/auth';
import { validateSchema } from '@/middleware/validator.middleware';
import { createAddressSchema, updateAddressSchema } from '@/schemas/address.schema';

const router: Router = Router();

// Todas las rutas de direcciones requieren estar autenticado
router.use(protect);

router.get('/', AddressController.getUserAddresses);
router.post('/', validateSchema(createAddressSchema), AddressController.createAddress);
router.get('/:id', AddressController.getAddressById);
router.patch('/:id', validateSchema(updateAddressSchema), AddressController.updateAddress);
router.delete('/:id', AddressController.deleteAddress);

export default router;
