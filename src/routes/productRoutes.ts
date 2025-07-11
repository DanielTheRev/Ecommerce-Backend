import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { protect, adminOnly } from '../middleware/auth';

const router: Router = Router();

// Rutas públicas (sin autenticación)
router.get('/search', ProductController.searchProducts);  // Buscar productos
router.get('/', ProductController.getAllProducts);        // Ver todos los productos
router.get('/:id', ProductController.getProductById);    // Ver producto específico

// Rutas protegidas (solo administradores)
router.post('/', protect, adminOnly, ProductController.createProduct);     // Crear producto
router.put('/:id', protect, adminOnly, ProductController.updateProduct);   // Actualizar producto completo
router.patch('/:id', protect, adminOnly, ProductController.patchProduct);  // Actualización parcial
router.delete('/:id', protect, adminOnly, ProductController.deleteProduct);// Eliminar producto

export default router;
