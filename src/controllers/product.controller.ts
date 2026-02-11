import { NextFunction, Request, Response } from 'express';
import { IProductCreateDTO, IProductSpec, IProductUpdateDTO } from '@/interfaces/product.interface';
import { ProductService } from '@/services/product.service';
import { getDolar } from '@/services/dolar.service';
import { PaymentService } from '@/services/Payment.service';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';

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
	static async getAllProductWOPagination(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const products = await ProductService.getAllProducts();
			res.status(200).json(products);
		} catch (error) {
			next(error);
		}
	}
	// GET /api/products - Obtener todos los productos
	static async getAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const result = await ProductService.getPaginatedProducts(page, limit);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products/:id - Obtener un producto por ID
	static async getProductBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { slug } = req.params;
			const product = await ProductService.getProductBySlug(slug);

			res.status(200).json(product);
		} catch (error) {
			next(error);
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
			res.status(201).json(newProduct);
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/products/:id - Actualizar un producto completo
	static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
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
			next(error);
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
	static async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const product = await ProductService.deleteProduct(id);

			res.status(200).json({
				success: true,
				message: 'Producto eliminado exitosamente',
				data: product
			});
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products/search - Buscar productos
	static async searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
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
			next(error);
		}
	}

	// POST /api/products/calculate-prices - Calcular precios antes de guardar
	static async calculatePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
		try {
			const { costPrice } = req.body;
			const { venta } = await getDolar();
			const prices = await PaymentService.CalculatePrices(
				EcommercePaymentProviders.UALA,
				costPrice,
				venta
			);

			res.status(200).json(prices);
		} catch (error) {
			next(error);
		}
	}
}
