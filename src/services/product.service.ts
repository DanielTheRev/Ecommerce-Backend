import { AppError } from '@/errors/app.error';
import { paginate } from '@/utils/pagination.util';
import { IProduct, IProductCreateDTO, IProductUpdateDTO } from '@/interfaces/product.interface';
import { TenantModels } from '@/config/modelRegistry';
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
		ALLOWED_ATTR: ['href', 'target', 'class'],
		ALLOW_DATA_ATTR: false,
	};

	// ============ DISCRIMINATOR HELPER ============

	/**
	 * Retorna el modelo correcto según el tipo de producto.
	 * MULTI-TENANT: Usa los modelos registrados en la conexión del tenant.
	 */
	private static getModel(models: TenantModels, type?: string): any {
		switch (type) {
			case 'tech': return models.TechProduct;
			case 'clothing': return models.ClothingProduct;
			default: return models.Product;
		}
	}

	// ============ READ METHODS ============

	static async getAllProducts(models: TenantModels, productType?: string): Promise<IProduct[]> {
		try {
			const Model = this.getModel(models, productType);
			const products = (await Model.find().lean()) as unknown as IProduct[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductsWCompletePrices(models: TenantModels, productType?: string): Promise<IProduct[]> {
		try {
			const Model = this.getModel(models, productType);
			const products = await Model.find()
				.select('+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings')
				.lean() as unknown as IProduct[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductWCompletePrices(models: TenantModels, id: string): Promise<IProduct> {
		try {
			const product = await models.Product.findById(id)
				.select('+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas')
				.lean() as unknown as IProduct;
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductById(models: TenantModels, id: string): Promise<IProduct> {
		try {
			const product = (await models.Product.findById(id).lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product', 'Error al obtener el producto', 500);
		}
	}

	static async getProductsByIds(models: TenantModels, ids: string[]): Promise<IProduct[]> {
		try {
			const products = (await models.Product.find({
				_id: { $in: ids }
			}).select('+prices.costPrice').lean()) as unknown as IProduct[];
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

	static async getPaginatedProducts(models: TenantModels, page: number = 1, limit: number = 20, productType?: string) {
		try {
			const Model = this.getModel(models, productType);
			const result = await paginate(Model, {}, {
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

	static async getPaginatedProductsWCompletePrices(models: TenantModels, page: number = 1, limit: number = 10, productType?: string) {
		try {
			const Model = this.getModel(models, productType);
			const result = await paginate(Model, {}, {
				page,
				limit,
				sort: { 'prices.efectivo_transferencia': -1 },
				select: '+prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings'
			});
			return result;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch paginated products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductBySlug(models: TenantModels, slug: string): Promise<IProduct> {
		try {
			const product = (await models.Product.findOne({ slug }).lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product by slug', 'Error al obtener el producto', 500);
		}
	}

	static async getSearchSuggestions(models: TenantModels, queryText: string, limit: number = 10, productType?: string): Promise<IProduct[]> {
		try {
			const Model = this.getModel(models, productType);
			const query = {
				$or: [
					{ brand: { $regex: queryText, $options: 'i' } },
					{ model: { $regex: queryText, $options: 'i' } }
				]
			};
			const products = await Model.find(query)
				.sort({ 'prices.efectivo_transferencia': -1 })
				.limit(limit)
				.lean() as unknown as IProduct[];
			return products;
		} catch (error) {
			throw new AppError('Failed to get suggestions', 'Error al obtener sugerencias', 500);
		}
	}

	static async searchProducts(
		models: TenantModels,
		filters: {
			q?: string;
			minPrice?: number;
			maxPrice?: number;
			minRating?: number;
		},
		page: number = 1,
		limit: number = 10,
		productType?: string
	) {
		try {
			const Model = this.getModel(models, productType);
			const query: any = {};

			if (filters.q) {
				query.$or = [
					{ brand: { $regex: filters.q, $options: 'i' } },
					{ model: { $regex: filters.q, $options: 'i' } }
				];
			}

			if (filters.minPrice || filters.maxPrice) {
				query['prices.efectivo_transferencia'] = {};
				if (filters.minPrice) query['prices.efectivo_transferencia'].$gte = filters.minPrice;
				if (filters.maxPrice) query['prices.efectivo_transferencia'].$lte = filters.maxPrice;
			}

			if (filters.minRating) {
				query.rating = { $gte: filters.minRating };
			}

			const result = await paginate(Model, query, {
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

	// ============ CREATE ============

	static async createProduct(models: TenantModels, data: IProductCreateDTO, imagesDTO: Express.Multer.File[], tenantSlug: string = 'general'): Promise<IProduct> {
		try {
			const slug = this.generateSlug(data.brand, data.model);
			const { venta } = await getDolar();

			const prices = await PaymentService.CalculatePrices(
				EcommercePaymentProviders.UALA,
				data.price,
				venta,
				models
			);

			if (imagesDTO.length === 0) throw new AppError('No images provided', 'No se proporcionaron imágenes', 400);
			const rawImages = imagesDTO.map((image) => ({
				id: `${data.brand}-${data.model}`,
				source: image
			}));
			const images = await ImageService.UploadImages(rawImages, `${tenantSlug}/product-images`);

			// Elegir modelo según el tipo de producto
			const Model = this.getModel(models, data.productType);

			// Campos comunes
			const baseData: any = {
				slug,
				brand: data.brand,
				shortDescription: this.sanitizeDescription(data.shortDescription),
				largeDescription: this.sanitizeDescription(data.largeDescription),
				model: data.model,
				category: data.category,
				features: data.features,
				prices,
				images,
				specifications: data.specifications,
				variants: data.variants || []
			};

			// Campos específicos de tech
			if (data.productType === 'TechProduct') {
				if (data.storage) baseData.storage = data.storage;
				if (data.ram) baseData.ram = data.ram;
				if (data.processor) baseData.processor = data.processor;
				if (data.screenSize) baseData.screenSize = data.screenSize;
				if (data.os) baseData.os = data.os;
			}

			// Campos específicos de ropa
			if (data.productType === 'ClothingProduct') {
				if (data.gender) baseData.gender = data.gender;
				if (data.fit) baseData.fit = data.fit;
				if (data.material) baseData.material = data.material;
				if (data.composition) baseData.composition = data.composition;
				if (data.sizeType) baseData.sizeType = data.sizeType;
				if (data.careInstructions) baseData.careInstructions = data.careInstructions;
			}

			const newProduct = await Model.create(baseData);
			return newProduct.toObject() as unknown as IProduct;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create product', 'Error al crear el producto', 500);
		}
	}

	// ============ UPDATE ============

	static async updateProductById(models: TenantModels, id: string, updateData: Partial<IProductUpdateDTO>, files: Express.Multer.File[], tenantSlug: string = 'general'): Promise<IProduct> {
		try {
			const imagesToDelete = JSON.parse((updateData.deletedImages || '[]') as string) as string[];

			const product = await ProductService.getProductById(models, id);

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

				const newImages = await ImageService.UploadImages(rawImages, `${tenantSlug}/product-images`);
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
					venta,
					models
				);
				updateData.prices = prices;
			};

			if (updateData.specifications) updateData.specifications = JSON.parse(updateData.specifications as string);
			if (updateData.storage) updateData.storage = JSON.parse(updateData.storage as string);
			if (updateData.features) updateData.features = JSON.parse(updateData.features as string);
			if (updateData.variants) updateData.variants = JSON.parse(updateData.variants as string);
			if (updateData.careInstructions) updateData.careInstructions = JSON.parse(updateData.careInstructions as string);
			if (updateData.composition) updateData.composition = JSON.parse(updateData.composition as string);

			const fieldsToSelect = Object.keys(updateData).join(' ') + (updateData.slug ? ' slug' : '');

			const updatedProduct = await models.Product.findByIdAndUpdate(
				id,
				{ $set: updateData },
				{
					new: true,
					runValidators: true,
					select: fieldsToSelect
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

	static async simpleUpdateProduct(models: TenantModels, id: string, updateData: IProductUpdateDTO): Promise<IProduct> {
		try {
			const product = await models.Product.findByIdAndUpdate(id, updateData, {
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

	// ============ DELETE ============

	static async deleteProduct(models: TenantModels, id: string): Promise<IProduct> {
		try {
			const product = await models.Product.findByIdAndDelete(id).lean() as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to delete product', 'Error al eliminar el producto', 500);
		}
	}

	// ============ VARIANT STOCK MANAGEMENT ============

	static async verifyVariantStock(
		models: TenantModels,
		items: { productId: string; variantSku: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of items) {
				const product = await models.Product.findById(item.productId).lean() as any;
				if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

				const variant = product.variants.find(
					(v: any) => v.sku === item.variantSku && v.isActive
				);

				if (!variant) {
					throw new AppError(
						`Variant ${item.variantSku} not found`,
						`Variante ${item.variantSku} no encontrada o inactiva`,
						404
					);
				}

				const availableStock = variant.stock - variant.reservedStock;
				if (availableStock < item.quantity) {
					throw new AppError(
						`Insufficient stock for variant ${item.variantSku}`,
						`Stock insuficiente para la variante ${item.variantSku}`,
						400
					);
				}
			}
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to verify variant stock',
				'Error al verificar el stock de la variante',
				500
			);
		}
	}

	static async reduceVariantStock(
		models: TenantModels,
		items: { productId: string; variantSku: string; quantity: number }[]
	): Promise<boolean> {
		try {
			const operations = items.map((item) => ({
				updateOne: {
					filter: {
						_id: item.productId,
						'variants.sku': item.variantSku,
						'variants.stock': { $gte: item.quantity }
					},
					update: {
						$inc: {
							'variants.$[elem].stock': -item.quantity
						}
					},
					arrayFilters: [{ 'elem.sku': item.variantSku }]
				}
			}));

			const result = await models.Product.bulkWrite(operations, { ordered: true });

			if (result.modifiedCount !== items.length) {
				throw new AppError(
					'Stock reduction failed for one or more variants',
					'No se pudo reducir el stock de una o más variantes',
					400
				);
			}

			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to reduce variant stock',
				'Error al reducir el stock de la variante',
				500
			);
		}
	}

	static async restoreVariantStock(
		models: TenantModels,
		items: { product: any; variantSku: string; quantity: number }[]
	) {
		for (const item of items) {
			try {
				await models.Product.findOneAndUpdate(
					{ _id: item.product, 'variants.sku': item.variantSku },
					{ $inc: { 'variants.$[elem].stock': item.quantity } },
					{ arrayFilters: [{ 'elem.sku': item.variantSku }] }
				);
			} catch (error) {
				if (error instanceof AppError) throw error;
				throw new AppError(
					'Failed to restore variant stock',
					'Error al restaurar el stock de la variante',
					500
				);
			}
		}
	}

	// ============ PRIVATE HELPERS ============

	private static sanitizeDescription(description: string): string {
		const window = new JSDOM(description).window;
		const domPurify = createDOMPurify(window);
		const dom = window.document;

		dom.body.querySelectorAll('*').forEach(el => {
			el.childNodes.forEach(node => {
				if (node.nodeType === dom.TEXT_NODE) {
					if (node.textContent)
						node.textContent = node.textContent.replace(/\u00A0/g, ' ');
				}
			});
		});

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
}
