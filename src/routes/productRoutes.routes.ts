import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { protect, adminOnly } from '../middleware/auth';

const router: Router = Router();

// Rutas públicas (sin autenticación)
router.get('/search', ProductController.searchProducts); // Buscar productos
router.get('/', ProductController.getAllProducts); // Ver todos los productos
router.get('/all', ProductController.getAllProductWOPagination); // Ver todos los productos sin Paginación
router.get('/:slug', ProductController.getProductBySlug); // Ver producto específico por slug

// Rutas protegidas (solo administradores)
router.post('/', protect, adminOnly, ProductController.createProduct); // Crear producto
router.put('/:id', protect, adminOnly, ProductController.updateProduct); // Actualizar producto completo
router.patch('/:id', protect, adminOnly, ProductController.patchProduct); // Actualización parcial
router.delete('/:id', protect, adminOnly, ProductController.deleteProduct); // Eliminar producto

export default router;
