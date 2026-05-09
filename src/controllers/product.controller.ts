import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { IProductCreateDTO, IProductSpec, ProductType } from '@/interfaces/product.interface';
import { IClothingVariant, ITechVariant } from '@/interfaces/variant.interface';
import { AuthRequest } from '@/middleware/auth';
import { getDolar } from '@/services/dolar.service';
import { PaymentService } from '@/services/Payment.service';
import { ProductService } from '@/services/product.service';
import { NextFunction, Response } from 'express';

export class ProductController {
	// GET /api/products/list - Productos con precios completos (admin) - paginado
	static async getProducts(req: AuthRequest, res: Response, next: NextFunction) {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;
			const productType = req.query.type as string | undefined;
			const q = req.query.q as string | undefined;
			const category = req.query.category as string | undefined;
			const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
			const providerId = req.query.provider as string | undefined;
			const result = await ProductService.getPaginatedProductsWCompletePrices(req.models!, page, limit, productType, q, category, isActive, providerId);
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
		const data = req.body as IProductCreateDTO;
		// Con multer.fields(), req.files es un objeto { images: File[], seo_og_image: File[] }
		const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] };
		const imageFiles = uploadedFiles?.images ?? [];
		const ogImageFile = uploadedFiles?.seoImage?.[0] ?? null;
		try {
			data.specifications = JSON.parse(data.specifications as string) as IProductSpec[];
			data.features = JSON.parse(data.features as string) as string[];
			// Parsear Variantes con polimorfismo estricto
			const parsedVariants = JSON.parse(data.variants as string);

			if (data.productType === ProductType.TECH) {
				data.variants = parsedVariants as ITechVariant[];
			}
			if (data.productType === ProductType.CLOTHING) {
				data.variants = parsedVariants as IClothingVariant[];
				if (data.season) data.season = data.season;
			}
			if (data.tags) data.tags = JSON.parse(data.tags as string) as string[];

			// Tech-specific: parsear storage si viene
			if (data.storage) data.storage = JSON.parse(data.storage as string) as string[];

			// Clothing-specific: parsear arrays si vienen
			if (data.composition) data.composition = JSON.parse(data.composition as string);
			if (data.careInstructions) data.careInstructions = JSON.parse(data.careInstructions as string);

			// SEO: parsear el JSON string (og_image llega como archivo separado)
			if (data.seo) data.seo = JSON.parse(data.seo as unknown as string);

			const newProduct = await ProductService.createProduct(req.models!, data, imageFiles, ogImageFile, req.tenant?.slug);
			res.status(201).json(newProduct);
		} catch (error) {
			next(error);
		}
	}

	// PATCH /api/products/:id - Actualizar parcialmente un producto
	static async patchProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const id = req.params.id;
			const data = req.body;
			// Con multer.fields(), req.files es un objeto { images: File[], seo_og_image: File[] }
			const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] };
			const imageFiles = uploadedFiles?.images ?? [];
			const ogImageFile = uploadedFiles?.seoImage?.[0] ?? null;

			const updatedProduct = await ProductService.updateProductById(req.models!, id, data, imageFiles, ogImageFile, req.tenant?.slug);
			res.status(200).json(updatedProduct);
		} catch (error) {
			next(error);
		}
	}

	// PATCH /api/products/bulk-status - Actualizar estado de varios productos
	static async bulkUpdateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { ids, isActive } = req.body;
			if (!Array.isArray(ids)) {
				res.status(400).json({ success: false, message: 'Se requiere un array de IDs' });
				return;
			}
			await ProductService.bulkUpdateStatus(req.models!, ids, isActive);
			res.status(200).json({
				success: true,
				message: `Productos ${isActive ? 'activados' : 'desactivados'} exitosamente`
			});
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
			const { q, minPrice, maxPrice, minRating, suggestions, category, brand, gender, tags, featured } = req.query;
			const productType = req.query.type as string | undefined;

			// if suggestions is true, return only brand and model matches without pagination
			if (suggestions) {
				const products = await ProductService.getSearchSuggestions(req.models!, q as string, 10, productType);
				res.status(200).json(products);
				return;
			}

			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;
			const sortBy = req.query.sortBy as string | undefined || 'createdAt';
			const sortOrder = req.query.sortOrder as string | undefined || 'asc';
			const result = await ProductService.searchProducts({
				models: req.models!,
				filters: {
					q: q as string,
					minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
					maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
					minRating: minRating ? parseFloat(minRating as string) : undefined,
					category: category as string,
					brand: brand as string,
					gender: gender as string,
					tags: tags as string,
					featured: featured as unknown as boolean,
					sortBy: sortBy,
					sortOrder: sortOrder
				},
				page: page,
				limit: limit,
				productType: productType
			})



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
			const { costPrice, customProfitMargin, customProfitMargin1Pay, customProfitMarginInstallments } = req.body;
			const { venta } = await getDolar();
			const prices = await PaymentService.CalculatePrices({
				paymentProvider: EcommercePaymentProviders.MERCADOPAGO,
				cost_price: costPrice,
				dolar: venta,
				models: req.models!,
				customProfitMargin,
				customProfitMargin1Pay,
				customProfitMarginInstallments
			});

			res.status(200).json(prices);
		} catch (error) {
			next(error);
		}
	}
}
