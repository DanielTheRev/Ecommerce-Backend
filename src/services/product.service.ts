import { AppError } from '@/errors/app.error';
import { paginate } from '@/utils/pagination.util';
import { IOrderItem } from '@/interfaces/order.interface';
import { IProduct, IProductCreateDTO, IProductUpdateDTO } from '@/interfaces/product.interface';
import { Product } from '@/models/Product.model';
import slugify from 'slugify';
import { getDolar } from './dolar.service';
import { PaymentService } from './Payment.service';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { ImageService } from './images.service';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';




export class ProductService {
	private constructor() { }

	private static purifyConfig = {
		ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'span'],
		ALLOWED_ATTR: ['href', 'target', 'class'], // 'class' por si querés que Quill mantenga estilos
		ALLOW_DATA_ATTR: false, // Bloquea atributos data- que a veces se usan para ataques
	};

	static async updateProductById(id: string, updateData: Partial<IProductUpdateDTO>, files: Express.Multer.File[]): Promise<IProduct> {
		try {
			const imagesToDelete = JSON.parse((updateData.deletedImages || '[]') as string) as string[];

			const product = await ProductService.getProductById(id);

			if (!product) {
				throw new AppError('No product find by given id', 'Producto no encontrado', 404);
			}

			let currentImages = [...product.images];

			if (updateData.largeDescription) {
				updateData.largeDescription = this.sanitizeDescription(updateData.largeDescription);
			}

			if (updateData.shortDescription) {
				updateData.shortDescription = this.sanitizeDescription(updateData.shortDescription);
			}


			if (imagesToDelete.length > 0) {
				await Promise.all(imagesToDelete.map((pubId) => ImageService.DeleteImage(pubId)));
				currentImages = currentImages.filter((img) => !imagesToDelete.includes(img.public_id));
			}

			if (files && files.length > 0) {
				const brand = updateData.brand || product.brand;
				const model = updateData.model || product.model;

				const rawImages = files.map((file) => ({
					id: `${brand}-${model}`,
					source: file
				}));

				const newImages = await ImageService.UploadImages(rawImages, 'electromix/product-images');
				updateData.images = [...currentImages, ...newImages];
			} else if (imagesToDelete.length > 0) {
				updateData.images = currentImages;
			}


			if (updateData.brand || updateData.model) {
				const newBrand = updateData.brand || product.brand;
				const newModel = updateData.model || product.model;
				updateData.slug = this.generateSlug(newBrand, newModel);
			}

			if (updateData.price) {
				const { venta } = await getDolar();
				const prices = await PaymentService.CalculatePrices(
					EcommercePaymentProviders.UALA,
					updateData.price,
					venta
				);
				updateData.prices = prices;
			};

			if (updateData.specifications) updateData.specifications = JSON.parse(updateData.specifications as string);
			if (updateData.colors) updateData.colors = JSON.parse(updateData.colors as string);
			if (updateData.storage) updateData.storage = JSON.parse(updateData.storage as string);
			if (updateData.features) updateData.features = JSON.parse(updateData.features as string);

			const fieldsToSelect = Object.keys(updateData).join(' ') + (updateData.slug ? ' slug' : '');

			const updatedProduct = await Product.findByIdAndUpdate(
				id,
				{ $set: updateData },
				{
					new: true,
					runValidators: true,
					select: fieldsToSelect // <--- Solo devuelve lo que cambió + _id
				}
			).lean();

			if (!updatedProduct) {
				throw new AppError('Error updating product', 'No se pudo actualizar el producto', 404);
			}
			return updatedProduct as unknown as IProduct;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to update product', 'Error al actualizar el producto', 500);
		}
	}

	static async createProduct(data: IProductCreateDTO, imagesDTO: Express.Multer.File[]): Promise<IProduct> {
		try {
			// Validated by Zod Middleware
			const slug = this.generateSlug(data.brand, data.model);
			const { venta } = await getDolar();

			const prices = await PaymentService.CalculatePrices(
				EcommercePaymentProviders.UALA,
				data.price,
				venta
			);

			if (imagesDTO.length === 0) throw new AppError('No images provided', 'No se proporcionaron imágenes', 400);
			const rawImages = imagesDTO.map((image) => ({
				id: `${data.brand}-${data.model}`,
				source: image
			}));
			// TODO mejorar la ruta de las images en cloudinary
			const images = await ImageService.UploadImages(rawImages, 'electromix/product-images');
			const newProduct = await Product.create({
				slug,
				brand: data.brand,
				shortDescription: this.sanitizeDescription(data.shortDescription),
				largeDescription: this.sanitizeDescription(data.largeDescription),
				model: data.model,
				category: data.category,
				features: data.features,
				stock: 10,
				prices,
				images,
				colors: data.colors,
				storage: data.storage,
				specifications: data.specifications
			});
			return newProduct.toObject() as unknown as IProduct;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create product', 'Error al crear el producto', 500);
		}
	}

	static async getProductsWCompletePrices(): Promise<IProduct[]> {
		try {
			const products = await Product.find()
				.select('+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings')
				.lean() as unknown as IProduct[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}

	}

	static async getProductWCompletePrices(id: string): Promise<IProduct> {
		try {
			const product = await Product.findById(id).select('+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas').lean() as unknown as IProduct;
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}

	}


	static async getAllProducts(): Promise<IProduct[]> {
		try {
			const products = (await Product.find().lean()) as unknown as IProduct[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductById(id: string): Promise<IProduct> {
		try {
			const product = (await Product.findById(id).lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product', 'Error al obtener el producto', 500);
		}
	}

	static async getProductsByIds(ids: string[]): Promise<IProduct[]> {
		try {
			const products = (await Product.find({
				_id: { $in: ids }
			}).lean()) as unknown as IProduct[];
			if (products.length === 0)
				throw new AppError(
					'No products found for the given IDs',
					'No se encontraron productos para los IDs dados',
					404
				);
			if (products.length !== ids.length)
				throw new AppError(
					'Some products not found for the given IDs',
					'Algunos productos no se encontraron para los IDs dados',
					404
				);
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async verifyProductStockFromIds(
		products: { _id: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of products) {
				const prod = await Product.findById(item._id).lean();
				if (!prod)
					throw new AppError(
						`Product with ID ${item._id} not found`,
						`Producto ${item._id} no encontrado`,
						404
					);
				if (prod.stock < item.quantity)
					throw new AppError(
						`Insufficient stock for product ID ${item._id}`,
						`Stock insuficiente para el producto ${item._id}`,
						400
					);
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to verify product stock',
				'Error al verificar el stock del producto',
				500
			);
		}
	}

	static async reduceProductStock(
		products: { _id: string; quantity: number }[],
	): Promise<boolean> {
		try {
			const operations = products.map((item) => ({
				updateOne: {
					filter: {
						_id: item._id,
						stock: { $gte: item.quantity }
					},
					update: { $inc: { stock: -item.quantity } },
				},
			}));

			const result = await Product.bulkWrite(operations, { ordered: true });

			if (result.modifiedCount !== products.length) {
				throw new AppError(
					'One or more products failed stock reduction (insufficient stock or invalid ID)',
					'Uno o más productos no pudieron reducir stock (stock insuficiente o ID inválido)',
					400
				);
			}

			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to reduce product stock',
				'Error al reducir el stock del producto',
				500
			);
		}
	}

	static async restoreProductStock(items: IOrderItem[]) {
		for (const item of items) {
			try {
				await Product.findByIdAndUpdate(
					item.product,
					{ $inc: { stock: item.quantity } },
					{ new: true }
				);
			} catch (error) {
				if (error instanceof AppError) throw error;
				throw new AppError(
					'Failed to restore product stock',
					'Error al restaurar el stock del producto',
					500
				);
			}
		}
	}



	private static sanitizeDescription(description: string): string {
		const window = new JSDOM(description).window;
		const domPurify = createDOMPurify(window);
		const dom = window.document;

		// 1️⃣ Reemplazar &nbsp;
		dom.body.querySelectorAll('*').forEach(el => {
			el.childNodes.forEach(node => {
				if (node.nodeType === dom.TEXT_NODE) {
					if (node.textContent)
						node.textContent = node.textContent.replace(/\u00A0/g, ' ');
				}
			});
		});

		// 2️⃣ Eliminar <p> vacíos o <p><br></p>
		dom.querySelectorAll('p').forEach(p => {
			const text = p.textContent?.trim();
			const onlyBr = p.children.length === 1 && p.children[0].tagName === 'BR';

			if (!text && onlyBr) {
				p.remove();
			}
		});

		return domPurify.sanitize(dom.body.innerHTML, this.purifyConfig);
	}

	private static generateSlug(brand: string, model: string): string {
		try {
			const slug = slugify(`${brand}-${model}`, {
				lower: true,
				strict: true
			});
			return slug;
		} catch (error) {
			throw new AppError(
				'ProductService.generateSlug: Error generating slug',
				'Error al generar el slug',
				500
			);
		}
	}

	static async getPaginatedProducts(page: number = 1, limit: number = 20) {
		try {
			// Sort by 'prices.efectivo_transferencia' descending as default in controller
			const result = await paginate(Product, {}, {
				page,
				limit,
				sort: { 'prices.efectivo_transferencia': -1 }
			});
			return result;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch paginated products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductBySlug(slug: string): Promise<IProduct> {
		try {
			const product = (await Product.findOne({ slug }).lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product by slug', 'Error al obtener el producto', 500);
		}
	}

	static async deleteProduct(id: string): Promise<IProduct> {
		try {
			const product = await Product.findByIdAndDelete(id).lean() as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to delete product', 'Error al eliminar el producto', 500);
		}
	}

	// Simple update for the PUT endpoint (direct update, no files/complex logic implied in original controller)
	static async simpleUpdateProduct(id: string, updateData: IProductUpdateDTO): Promise<IProduct> {
		try {
			const product = await Product.findByIdAndUpdate(id, updateData, {
				new: true,
				runValidators: true
			}).lean() as unknown as IProduct;

			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to update product', 'Error al actualizar el producto', 500);
		}
	}

	static async getSearchSuggestions(queryText: string, limit: number = 10): Promise<IProduct[]> {
		try {
			const query = {
				$or: [
					{ brand: { $regex: queryText, $options: 'i' } },
					{ model: { $regex: queryText, $options: 'i' } }
				]
			};
			const products = await Product.find(query)
				.sort({ 'prices.efectivo_transferencia': -1 })
				.limit(limit)
				.lean() as unknown as IProduct[];
			return products;
		} catch (error) {
			throw new AppError('Failed to get suggestions', 'Error al obtener sugerencias', 500);
		}
	}

	static async searchProducts(
		filters: {
			q?: string;
			minPrice?: number;
			maxPrice?: number;
			minRating?: number;
		},
		page: number = 1,
		limit: number = 10
	) {
		try {
			const query: any = {};

			if (filters.q) {
				query.$or = [
					{ brand: { $regex: filters.q, $options: 'i' } },
					{ model: { $regex: filters.q, $options: 'i' } }
				];
			}

			if (filters.minPrice || filters.maxPrice) {
				query.price = {};
				if (filters.minPrice) query.price.$gte = filters.minPrice;
				if (filters.maxPrice) query.price.$lte = filters.maxPrice;
			}

			if (filters.minRating) {
				query.rating = { $gte: filters.minRating };
			}

			const result = await paginate(Product, query, {
				page,
				limit,
				sort: { 'prices.efectivo_transferencia': -1 }
			});

			return result;

		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to search products', 'Error al buscar productos', 500);
		}
	}
}
