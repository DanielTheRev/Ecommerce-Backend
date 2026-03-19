import { Router } from 'express';
import { HeroController } from '../controllers/hero.controller';
import multer from 'multer';
const multerConfig = multer().fields([
  { name: 'imageDesktop', maxCount: 1 },
  { name: 'imageMobile', maxCount: 1 }
])


const router: Router = Router();

router.get('/', HeroController.getAll);
router.get('/:id', HeroController.getById);
router.post('/', multerConfig, HeroController.create);
router.put('/:id', multerConfig, HeroController.update);
router.delete('/:id', HeroController.delete);

export default router;
