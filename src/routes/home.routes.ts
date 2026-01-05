import { HomeController } from '@/controllers/home.controller';
import { Router } from 'express';

const router: Router = Router();

router.get('/home-config', HomeController.getHomeConfiguration);

export default router;
