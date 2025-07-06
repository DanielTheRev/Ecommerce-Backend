import { Router } from 'express';
import { ProductController } from '../controllers/productController';

const router: Router = Router();

// Ruta de búsqueda debe ir antes que /:id para evitar conflictos
router.get('/search', ProductController.searchProducts);

// Rutas CRUD básicas
router.get('/', ProductController.getAllProducts);
router.get('/:id', ProductController.getProductById);
router.post('/', ProductController.createProduct);
router.put('/:id', ProductController.updateProduct);
router.patch('/:id', ProductController.patchProduct);
router.delete('/:id', ProductController.deleteProduct);

export default router;
