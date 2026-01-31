import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { protect, adminOnly } from '../middleware/auth';
import multer from 'multer';

const router: Router = Router();

// Rutas públicas (sin autenticación)
router.get('/search', ProductController.searchProducts); // Buscar productos
router.get('/', ProductController.getAllProducts); // Ver todos los productos
router.get('/all', ProductController.getAllProductWOPagination); // Ver todos los productos sin Paginación
router.get('/:slug', ProductController.getProductBySlug); // Ver producto específico por slug
// multer configuration to handle image uploads
const multerConfig = multer().array('images', 5);

// Rutas protegidas (solo administradores)
router.post('/', protect, adminOnly, multerConfig, ProductController.createProduct); // Crear producto
router.put('/:id', protect, adminOnly, multerConfig, ProductController.updateProduct); // Actualizar producto completo
router.patch('/:id', protect, adminOnly, ProductController.patchProduct); // Actualización parcial
router.delete('/:id', protect, adminOnly, ProductController.deleteProduct); // Eliminar producto

export default router;
