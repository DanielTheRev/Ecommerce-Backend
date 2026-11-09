import { Router } from 'express';
import { FavoritesController } from '@/controllers/favorites.controller';
import { protect, adminOnly } from '@/middleware/auth';
import { requirePlanCapability } from '@/middleware/planGuard';

const router: Router = Router();

// Todas las rutas de favoritos requieren estar autenticado y plan con Tienda Web (Pro)
router.use(protect);
router.use(requirePlanCapability('hasFullWebStore', 'Favoritos de Tienda Web'));

// ==================== RUTAS DE ADMIN ====================
// Van primero para que /admin/* no matchee con /:productId
router.get('/admin/by-product', adminOnly, FavoritesController.getFavoritesByProduct);
router.post('/admin/notify-stock/:productId', adminOnly, FavoritesController.notifyBackInStock);

// ==================== RUTAS DE USUARIO ====================
router.get('/', FavoritesController.getUserFavorites);
router.post('/', FavoritesController.addFavorite);
router.get('/:productId/check', FavoritesController.isFavorite);
router.delete('/:productId', FavoritesController.removeFavorite);

export default router;
