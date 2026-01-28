import { Request, Response } from 'express';
import { Product } from '@/models/Product.model';
import { IProductCreateDTO, IProductUpdateDTO } from '@/interfaces/product.interface';
import { ProductService } from '@/services/product.service';

export class ProductController {
	// GET /api/products/all - Obtener todos los productos sin Paginación
	static async getAllProductWOPagination(req: Request, res: Response): Promise<void> {
		try {
			const products = await Product.find();
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
			const skip = (page - 1) * limit;

			const products = await Product.find()
				.skip(skip)
				.limit(limit)
				.sort({ 'prices.efectivo_transferencia': -1 });

			const total = await Product.countDocuments();

			// 🔍 Debug: Verificar valores de paginación
			// console.log('📊 Paginación Debug:', {
			// 	page: page,
			// 	limit: limit,
			// 	skip: skip,
			// 	total: total,
			// 	totalPages: Math.ceil(total / limit),
			// 	calculo: `${total} / ${limit} = ${total / limit}`
			// });

			res.status(200).json({
				data: products,
				pagination: {
					currentPage: page,
					totalPages: Math.ceil(total / limit),
					totalItems: total,
					itemsPerPage: limit
				}
			});
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
			const product = await Product.findOne({ slug });

			if (!product) {
				res.status(404).json({
					success: false,
					message: 'Producto no encontrado'
				});
				return;
			}

			res.status(200).json(product);
		} catch (error) {
			res.status(500).json({
				success: false,
				message: 'Error al obtener el producto'
			});
		}
	}

	// POST /api/products - Create new product
	static async createProduct(req: Request, res: Response): Promise<void> {
		let data = req.body as IProductCreateDTO;
		const files = req.files;
		console.log(data, files);
		// data.images = files as { file: Express.Multer.File }[];
		// const newProduct = await ProductService.createProduct()
	}

	// PUT /api/products/:id - Actualizar un producto completo
	static async updateProduct(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const updateData: IProductUpdateDTO = req.body;

			const product = await Product.findByIdAndUpdate(id, updateData, {
				new: true,
				runValidators: true
			});

			if (!product) {
				res.status(404).json({
					success: false,
					message: 'Producto no encontrado'
				});
				return;
			}

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
	static async patchProduct(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const updateData: Partial<IProductUpdateDTO> = req.body;

			const product = await Product.findByIdAndUpdate(
				id,
				{ $set: updateData },
				{ new: true, runValidators: true }
			);

			if (!product) {
				res.status(404).json({
					success: false,
					message: 'Producto no encontrado'
				});
				return;
			}

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

	// DELETE /api/products/:id - Eliminar un producto
	static async deleteProduct(req: Request, res: Response): Promise<void> {
		try {
			const { id } = req.params;
			const product = await Product.findByIdAndDelete(id);

			if (!product) {
				res.status(404).json({
					success: false,
					message: 'Producto no encontrado'
				});
				return;
			}

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
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;
			const skip = (page - 1) * limit;

			let query: any = {};
			// if suggestions is true, return only brand and model matches without pagination
			if (suggestions) {
				query.$or = [
					{ brand: { $regex: q, $options: 'i' } },
					{ model: { $regex: q, $options: 'i' } }
				];

				const products = await Product.find(query)
					.sort({ 'prices.efectivo_transferencia': -1 })
					.limit(limit);

				res.status(200).json(products);
				return;
			}
			// Búsqueda por texto
			if (q) {
				query.$or = [
					{ brand: { $regex: q, $options: 'i' } },
					{ model: { $regex: q, $options: 'i' } }
				];
			}

			// Filtros por precio
			if (minPrice || maxPrice) {
				query.price = {};
				if (minPrice) query.price.$gte = parseFloat(minPrice as string);
				if (maxPrice) query.price.$lte = parseFloat(maxPrice as string);
			}

			// Filtro por rating
			if (minRating) {
				query.rating = { $gte: parseFloat(minRating as string) };
			}

			const products = await Product.find(query)
				.skip(skip)
				.limit(limit)
				.sort({ 'prices.efectivo_transferencia': -1 });

			const total = await Product.countDocuments(query);

			res.status(200).json({
				success: true,
				data: products,
				pagination: {
					currentPage: page,
					totalPages: Math.ceil(total / limit),
					totalItems: total,
					itemsPerPage: limit
				}
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
