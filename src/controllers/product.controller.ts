import { NextFunction, Request, Response } from 'express';
import { IProductCreateDTO, IProductSpec, IProductUpdateDTO } from '@/interfaces/product.interface';
import { ProductService } from '@/services/product.service';

export class ProductController {
	static async getProducts(req: Request, res: Response, next: NextFunction) {
		try {
			const products = await ProductService.getProductsWCompletePrices();
			res.status(200).json(products);
		} catch (error) {
			next(error);
		}
	}
	static async getProductWCompletePrices(req: Request, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const product = await ProductService.getProductWCompletePrices(id);
			res.status(200).json(product);
		} catch (error) {
			next(error);
		}
	}
	// GET /api/products/all - Obtener todos los productos sin Paginación
	static async getAllProductWOPagination(req: Request, res: Response): Promise<void> {
		try {
			const products = await ProductService.getAllProducts();
			res.status(200).json(products);
		} catch (error) {
			res.status(500).json({
				message: 'Error al obtener los productos',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}
	// GET /api/products - Obtener todos los productos
	static async getAllProducts(req: Request, res: Response): Promise<void> {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const result = await ProductService.getPaginatedProducts(page, limit);

			res.status(200).json(result);
		} catch (error) {
			res.status(500).json({
				message: 'Error al obtener los productos',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// GET /api/products/:id - Obtener un producto por ID
	static async getProductBySlug(req: Request, res: Response): Promise<void> {
		try {
			const { slug } = req.params;
			const product = await ProductService.getProductBySlug(slug);

			res.status(200).json(product);
		} catch (error) {
			// If error is 404 handled in service, it will be caught here but we might want to ensure status code
			// For now, mirroring previous behavior but assuming AppError handling in middleware or manual response
			// Previous code manually checked !product. Service throws if not found.
			res.status(404).json({
				success: false,
				message: 'Producto no encontrado'
			});
		}
	}

	// POST /api/products - Create new product
	static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
		let data = req.body as IProductCreateDTO;
		const files = req.files as Express.Multer.File[];
		try {
			data.specifications = JSON.parse(data.specifications as string) as IProductSpec[];
			data.colors = JSON.parse(data.colors as string) as string[];
			data.storage = JSON.parse(data.storage as string) as string[];
			data.features = JSON.parse(data.features as string) as string[];
			const newProduct = await ProductService.createProduct(data, files);
			res.status(201).json({
				success: true,
				message: 'Producto creado exitosamente',
				data: newProduct
			});
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/products/:id - Actualizar un producto completo
	static async updateProduct(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const updateData: IProductUpdateDTO = req.body;

			const product = await ProductService.simpleUpdateProduct(id, updateData);

			res.status(200).json({
				success: true,
				message: 'Producto actualizado exitosamente',
				data: product
			});
		} catch (error) {
			res.status(400).json({
				success: false,
				message: 'Error al actualizar el producto',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// PATCH /api/products/:id - Actualizar parcialmente un producto
	static async patchProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = req.params.id;
			const data = req.body;
			const files = req.files as Express.Multer.File[];
			const updatedProduct = await ProductService.updateProductById(id, data, files);

			res.status(200).json(updatedProduct);
		} catch (error) {
			next(error);
		}
	}

	// DELETE /api/products/:id - Eliminar un producto
	static async deleteProduct(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const product = await ProductService.deleteProduct(id);

			res.status(200).json({
				success: true,
				message: 'Producto eliminado exitosamente',
				data: product
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: 'Error al eliminar el producto',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}

	// GET /api/products/search - Buscar productos
	static async searchProducts(req: Request, res: Response): Promise<void> {
		try {
			const { q, minPrice, maxPrice, minRating, suggestions } = req.query;
			
			// if suggestions is true, return only brand and model matches without pagination
			if (suggestions) {
				const products = await ProductService.getSearchSuggestions(q as string);
				res.status(200).json(products);
				return;
			}

			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;

			const result = await ProductService.searchProducts({
				q: q as string,
				minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
				maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
				minRating: minRating ? parseFloat(minRating as string) : undefined
			}, page, limit);

			res.status(200).json({
				success: true,
				data: result.data,
				pagination: result.pagination
			});
		} catch (error) {
			res.status(500).json({
				success: false,
				message: 'Error al buscar productos',
				error: error instanceof Error ? error.message : 'Error desconocido'
			});
		}
	}
}
