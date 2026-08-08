import { Router } from "express";
import { ProviderController } from "@/controllers/provider.controller";
import { protect, adminOnly } from "@/middleware/auth";


const router: Router = Router();

router.get('/', protect, adminOnly, ProviderController.getProviders);
router.get('/:id', protect, adminOnly, ProviderController.getProviderByIdWithProducts);
router.post('/', protect, adminOnly, ProviderController.createProvider);
router.put('/:id', protect, adminOnly, ProviderController.updateProvider);
router.delete('/:id', protect, adminOnly, ProviderController.deleteProvider);

export default router;