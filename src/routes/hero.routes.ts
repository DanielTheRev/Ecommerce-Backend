import { Router } from 'express';
import { HeroController } from '../controllers/hero.controller';
import { imageUpload } from '@/config/multer';
const multerConfig = imageUpload.fields([
  { name: 'imageDesktop1', maxCount: 1 },
  { name: 'imageDesktop2', maxCount: 1 },
  { name: 'imageMobile1', maxCount: 1 },
  { name: 'imageMobile2', maxCount: 1 }
])


const router: Router = Router();

router.get('/', HeroController.getAll);
router.get('/:id', HeroController.getById);
router.post('/', multerConfig, HeroController.create);
router.put('/:id', multerConfig, HeroController.update);
router.delete('/:id', HeroController.delete);

export default router;
