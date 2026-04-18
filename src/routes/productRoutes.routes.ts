import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { protect, adminOnly } from '../middleware/auth';
import multer from 'multer';

import { validateSchema } from '@/middleware/validator.middleware';
import { CreateProductSchema, UpdateProductSchema, PriceCalculatorSchema } from '@/schemas/product.schema';

const router: Router = Router();


const multerConfig = multer().fields([
	{ name: 'images', maxCount: 10 },
	{ name: 'seoImage', maxCount: 1 }
]);
// Rutas protegidas (solo administradores)
router.get('/admin/list', protect, adminOnly, ProductController.getProducts); // products con precios completos
router.post('/calculate-prices', protect, adminOnly, validateSchema(PriceCalculatorSchema), ProductController.calculatePrice); // Calculadora de precios
router.get('/complete/:id', protect, adminOnly, ProductController.getProductWCompletePrices); // product con precios completos
router.post('/', protect, adminOnly, multerConfig, validateSchema(CreateProductSchema), ProductController.createProduct); // Crear producto
router.patch('/:id', protect, adminOnly, multerConfig, validateSchema(UpdateProductSchema), ProductController.patchProduct); // Actualización parcial
router.delete('/:id', protect, adminOnly, ProductController.deleteProduct); // Eliminar producto

// Rutas públicas (sin autenticación)
router.get('/search', ProductController.searchProducts); // Buscar productos
router.get('/metadata', ProductController.getMetadata); // Metadatos (marcas, categorías, tags)
router.get('/slugs', ProductController.getAllSlugs); // Obtener todos los slugs para SSR
router.get('/', ProductController.getAllProducts); // Ver todos los productos
router.get('/all', ProductController.getAllProductWOPagination); // Ver todos los productos sin Paginación
router.get('/:slug', ProductController.getProductBySlug); // Ver producto específico por slug





export default router;
