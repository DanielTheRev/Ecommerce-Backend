import { NextFunction, Response } from 'express';
import { IProductCreateDTO, IProductSpec } from '@/interfaces/product.interface';
import { IVariant } from '@/interfaces/variant.interface';
import { ProductService } from '@/services/product.service';
import { getDolar } from '@/services/dolar.service';
import { PaymentService } from '@/services/Payment.service';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { AuthRequest } from '@/middleware/auth';

export class ProductController {
	// GET /api/products/list - Productos con precios completos (admin) - paginado
	static async getProducts(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;
			const productType = req.query.type as string | undefined;
			const q = req.query.q as string | undefined;
			const category = req.query.category as string | undefined;
			const result = await ProductService.getPaginatedProductsWCompletePrices(req.models!, page, limit, productType, q, category);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products/complete/:id - Producto con precios completos (admin)
	static async getProductWCompletePrices(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const { id } = req.params;
			const product = await ProductService.getProductWCompletePrices(req.models!, id);
			res.status(200).json(product);
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products/all - Obtener todos los productos sin Paginación
	static async getAllProductWOPagination(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const productType = req.query.type as string | undefined;
			const products = await ProductService.getAllProducts(req.models!, productType);
			res.status(200).json(products);
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products/slugs - Obtener solo los slugs de todos los productos para SSR
	static async getAllSlugs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const slugs = await ProductService.getAllProductSlugs(req.models!);
			res.status(200).json(slugs);
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products - Obtener todos los productos con paginación
	static async getAllProducts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;
			const productType = req.query.type as string | undefined;
			const category = req.query.category as string | undefined;

			const result = await ProductService.getPaginatedProducts(req.models!, page, limit, productType, category);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products/:slug - Obtener un producto por slug
	static async getProductBySlug(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { slug } = req.params;
			const product = await ProductService.getProductBySlug(req.models!, slug);

			res.status(200).json(product);
		} catch (error) {
			next(error);
		}
	}

	// POST /api/products - Crear nuevo producto
	static async createProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		let data = req.body as IProductCreateDTO;
		const files = req.files as Express.Multer.File[];
		try {
			data.specifications = JSON.parse(data.specifications as string) as IProductSpec[];
			data.features = JSON.parse(data.features as string) as string[];
			data.variants = JSON.parse(data.variants as string) as IVariant[];
			if (data.tags) data.tags = JSON.parse(data.tags as string) as string[];

			// Tech-specific: parsear storage si viene
			if (data.storage) data.storage = JSON.parse(data.storage as string) as string[];

			// Clothing-specific: parsear arrays si vienen
			if (data.composition) data.composition = JSON.parse(data.composition as string);
			if (data.careInstructions) data.careInstructions = JSON.parse(data.careInstructions as string);

			const newProduct = await ProductService.createProduct(req.models!, data, files, req.tenant?.slug);
			res.status(201).json(newProduct);
		} catch (error) {
			next(error);
		}
	}

	// PUT /api/products/:id - Actualizar un producto completo
	static async updateProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const updateData = req.body;

			const product = await ProductService.simpleUpdateProduct(req.models!, id, updateData);

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
	static async patchProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = req.params.id;
			const data = req.body;
			const files = req.files as Express.Multer.File[];
			const updatedProduct = await ProductService.updateProductById(req.models!, id, data, files, req.tenant?.slug);

			res.status(200).json(updatedProduct);
		} catch (error) {
			next(error);
		}
	}

	// DELETE /api/products/:id - Eliminar un producto
	static async deleteProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const product = await ProductService.deleteProduct(req.models!, id);

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
	static async searchProducts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { q, minPrice, maxPrice, minRating, suggestions, category, brand, gender, tags } = req.query;
			const productType = req.query.type as string | undefined;

			// if suggestions is true, return only brand and model matches without pagination
			if (suggestions) {
				const products = await ProductService.getSearchSuggestions(req.models!, q as string, 10, productType);
				res.status(200).json(products);
				return;
			}

			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;

			const result = await ProductService.searchProducts(req.models!, {
				q: q as string,
				minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
				maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
				minRating: minRating ? parseFloat(minRating as string) : undefined,
				category: category as string,
				brand: brand as string,
				gender: gender as string,
				tags: tags as string
			}, page, limit, productType);

			res.status(200).json({
				success: true,
				data: result.data,
				pagination: result.pagination
			});
		} catch (error) {
			next(error);
		}
	}

	// GET /api/products/metadata - Obtener metadata (marcas, categorías, tags)
	static async getMetadata(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const productType = req.query.type as string | undefined;
			const metadata = await ProductService.getProductMetadata(req.models!, productType);
			res.status(200).json(metadata);
		} catch (error) {
			next(error);
		}
	}

	// POST /api/products/calculate-prices - Calcular precios antes de guardar
	static async calculatePrice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { costPrice, customProfitMargin } = req.body;
			const { venta } = await getDolar();
			const prices = await PaymentService.CalculatePrices(
				EcommercePaymentProviders.MERCADOPAGO,
				costPrice,
				venta,
				req.models!,
				customProfitMargin
			);

			res.status(200).json(prices);
		} catch (error) {
			next(error);
		}
	}
}
