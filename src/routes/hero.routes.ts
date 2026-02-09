import { Router } from 'express';
import { HeroController } from '../controllers/hero.controller';

const router: Router = Router();

router.get('/', HeroController.getAll);
router.get('/:id', HeroController.getById);
router.post('/', HeroController.create);
router.put('/:id', HeroController.update);
router.delete('/:id', HeroController.delete);

export default router;
