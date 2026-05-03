import { Router } from 'express';
import { FavoritesController } from '@/controllers/favorites.controller';
import { protect } from '@/middleware/auth';

const router: Router = Router();

// Todas las rutas de favoritos requieren estar autenticado
router.use(protect);

router.get('/', FavoritesController.getUserFavorites);
router.post('/', FavoritesController.addFavorite);
router.get('/:productId/check', FavoritesController.isFavorite);
router.delete('/:productId', FavoritesController.removeFavorite);

export default router;
