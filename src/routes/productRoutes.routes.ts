import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { protect, adminOnly } from '../middleware/auth';
import multer from 'multer';

const router: Router = Router();

const multerConfig = multer().array('images', 5);
// Rutas protegidas (solo administradores)
router.get('/list', protect, adminOnly, ProductController.getProducts); // products con precios completos
router.get('/complete/:id', protect, adminOnly, ProductController.getProductWCompletePrices); // product con precios completos
router.post('/', protect, adminOnly, multerConfig, ProductController.createProduct); // Crear producto
router.put('/:id', protect, adminOnly, multerConfig, ProductController.updateProduct); // Actualizar producto completo
router.patch('/:id', protect, adminOnly, multerConfig, ProductController.patchProduct); // Actualización parcial
router.delete('/:id', protect, adminOnly, ProductController.deleteProduct); // Eliminar producto

// Rutas públicas (sin autenticación)
router.get('/search', ProductController.searchProducts); // Buscar productos
router.get('/', ProductController.getAllProducts); // Ver todos los productos
router.get('/all', ProductController.getAllProductWOPagination); // Ver todos los productos sin Paginación
router.get('/:slug', ProductController.getProductBySlug); // Ver producto específico por slug





export default router;
