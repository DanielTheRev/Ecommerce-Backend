import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { IProduct, IProductCreateDTO, IProductUpdateDTO, ProductType } from '@/interfaces/product.interface';
import { paginate } from '@/utils/pagination.util';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { Types } from 'mongoose';
import slugify from 'slugify';
import { getDolar } from './dolar.service';
import { ImageService } from './images.service';
import { PaymentService } from './Payment.service';


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
			case ProductType.TECH: return models.TechProduct;
			case ProductType.CLOTHING: return models.ClothingProduct;
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


	static async getProductWCompletePrices(models: TenantModels, id: string, productType?: string): Promise<IProduct> {
		try {
			const Model = this.getModel(models, productType);
			const product = await Model.findById(id)
				.select('+provider +prices.costPrice +prices.earnings +prices.dolarPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.profitMargin1Pay +prices.profitMarginInstallments')
				.populate('provider')
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

	static async processOrderItems(
		models: TenantModels,
		items: { _id: string; sku: string; quantity: number }[]
	) {
		try {
			const productIds = items.map(i => i._id);
			const products = (await models.Product.find({
				_id: { $in: productIds }
			}).select('+provider +prices.costPrice +prices.dolarPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings')
				.populate('provider')
				.lean()) as unknown as IProduct[];
			if (products.length === 0)
				throw new AppError(
					'No products found for the given IDs',
					'No se encontraron productos para los IDs dados',
					404
				);

			const foundIds = new Set(products.map(p => p._id.toString()));
			const missingIds = productIds.filter(id => !foundIds.has(id));
			if (missingIds.length > 0)
				throw new AppError(
					'Some products not found for the given IDs',
					'Algunos productos no se encontraron para los IDs dados',
					404
				);

			const finalItems: any[] = [];
			const bulkOperations: any[] = [];

			for (const item of items) {
				const product = products.find(p => p._id.toString() === item._id.toString());
				if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

				const variant = product.variants?.find((v: any) => v.sku === item.sku && v.isActive !== false) as any;
				if (!variant) {
					throw new AppError(
						`Variant ${item.sku} not found`,
						`Variante ${item.sku} no encontrada o inactiva`,
						404
					);
				}

				const availableStock = variant.stock - (variant.reservedStock || 0);
				if (availableStock < item.quantity) {
					throw new AppError(
						`Insufficient stock for variant ${item.sku}`,
						`Stock insuficiente para la variante ${item.sku}`,
						400
					);
				}

				bulkOperations.push({
					updateOne: {
						filter: {
							_id: new Types.ObjectId(item._id),
							'variants.sku': item.sku,
							'variants.stock': { $gte: item.quantity }
						},
						update: {
							$inc: {
								'variants.$[elem].stock': -item.quantity
							}
						},
						arrayFilters: [{ 'elem.sku': item.sku }]
					}
				});

				// Extraemos los campos estrictamente operativos de la base de datos.
				// ...variantData absorberá dinámicamente CUALQUIER propiedad presente 
				// dependiente del tipo de variante (size, attributes, olor, peso, etc)
				const {
					stock,
					reservedStock,
					isActive,
					_id,
					id,
					...variantData
				} = variant as any;

				let variantSnapshot = { ...variantData };

				finalItems.push({
					productSnapshot: {
						_id: product._id,
						brand: product.brand,
						model: product.model,
						image: variant.imageReference?.url || product.images?.[0]?.url || '',
						slug: product.slug || '',
						prices: product.prices,
						providerSnapshot: product.provider,
					},
					variantSnapshot,
					quantity: item.quantity,
					price: 0,
					data: product
				});
			}

			if (bulkOperations.length > 0) {
				const result = await models.Product.collection.bulkWrite(bulkOperations, { ordered: true });
				if (result.modifiedCount !== items.length) {
					throw new AppError(
						'Stock reduction failed for one or more variants',
						'No se pudo reducir el stock de una o más variantes (posible falta de stock)',
						400
					);
				}
			}

			return finalItems;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch and process products variants', 'Error al procesar los productos', 500);
		}
	}


	static async getProductsByIds(models: TenantModels, ids: string[]): Promise<IProduct[]> {
		try {
			const products = (await models.Product.find({
				_id: { $in: ids }
			}).select('+prices.costPrice +prices.dolarPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings')
				.lean()) as unknown as IProduct[];
			if (products.length === 0)
				throw new AppError(
					'No products found for the given IDs',
					'No se encontraron productos para los IDs dados',
					404
				);

			const foundIds = new Set(products.map(p => p._id.toString()));
			const missingIds = ids.filter(id => !foundIds.has(id));
			if (missingIds.length > 0)
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

	static async getAllProductSlugs(models: TenantModels): Promise<{ slug: string }[]> {
		try {
			// Explicitly exclude _id and the discriminator key (productType)
			const products = await models.Product.find({}).select('slug -_id -productType').lean() as unknown as { slug: string }[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product slugs', 'Error al obtener los slugs de los productos', 500);
		}
	}

	static async getPaginatedProducts(models: TenantModels, page: number = 1, limit: number = 20, productType?: string, category?: string) {
		try {
			const Model = this.getModel(models, productType);
			const query: any = {};
			if (category) {
				query.category = category;
			}
			const result = await paginate(Model, query, {
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

	static async getPaginatedProductsWCompletePrices(models: TenantModels, page: number = 1, limit: number = 10, productType?: string, q?: string, category?: string) {
		try {
			const Model = this.getModel(models, productType);

			const query: any = {};
			if (q) {
				query.$or = [
					{ brand: { $regex: q, $options: 'i' } },
					{ model: { $regex: q, $options: 'i' } },
					{ name: { $regex: q, $options: 'i' } }
				];
			}
			if (category) {
				query.category = category;
			}

			const result = await paginate(Model, query, {
				page,
				limit,
				sort: { 'prices.efectivo_transferencia': -1 },
				select: '+provider +prices.costPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.earnings',
				populate: {
					path: 'provider',
				}
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

	static async getProductMetadata(models: TenantModels, productType?: string) {
		const Model = this.getModel(models, productType);
		const matchQuery = productType ? { productType } : {};

		try {
			const [brands, categories, tags] = await Promise.all([
				Model.distinct('brand', matchQuery),
				Model.distinct('category', matchQuery),
				Model.distinct('tags', matchQuery)
			]);
			return { brands, categories, tags };
		} catch (error) {
			throw new AppError('Failed to fetch metadata', 'Error al obtener metadata', 500);
		}
	}

	static async searchProducts(
		models: TenantModels,
		filters: {
			q?: string;
			minPrice?: number;
			maxPrice?: number;
			minRating?: number;
			category?: string;
			brand?: string;
			gender?: string;
			tags?: string;
			featured?: boolean;
		},
		page: number = 1,
		limit: number = 10,
		productType?: string
	) {
		try {
			const Model = this.getModel(models, productType);
			const query: any = {};

			if (filters.featured) {
				query.isFeatured = filters.featured;
			}

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

			if (filters.category) {
				const categories = filters.category.split(',').map(c => c.trim());
				query.category = { $in: categories };
			}

			if (filters.brand) {
				const brands = filters.brand.split(',').map(b => b.trim());
				query.brand = { $in: brands };
			}

			if (filters.gender) {
				const genders = filters.gender.split(',').map(g => g.trim());
				query.gender = { $in: genders };
			}

			if (filters.tags) {
				const tags = filters.tags.split(',').map(t => t.trim());
				query.tags = { $in: tags };
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


	static async createProduct(models: TenantModels, data: IProductCreateDTO, imagesDTO: Express.Multer.File[], ogImageFile: Express.Multer.File | null, tenantSlug: string = 'general'): Promise<IProduct> {
		try {
			const slug = this.generateSlug(data.brand, data.model);
			const { venta } = await getDolar();

			const prices = await PaymentService.CalculatePrices(
				{
					paymentProvider: EcommercePaymentProviders.MERCADOPAGO,
					cost_price: data.price,
					dolar: venta,
					models,
					customProfitMargin: data.customProfitMargin,
					customProfitMargin1Pay: data.customProfitMargin1Pay,
					customProfitMarginInstallments: data.customProfitMarginInstallments
				}
			);

			if (imagesDTO.length === 0) throw new AppError('No images provided', 'No se proporcionaron imágenes', 400);
			const rawImages = imagesDTO.map((image) => ({
				id: `${data.brand}-${data.model}`,
				source: image
			}));
			const images = await ImageService.UploadImages(rawImages, `${tenantSlug}/product-images`);

			if (data.variants && data.variants.length > 0 && Array.isArray(data.variants)) {
				data.variants = data.variants.map((v: any) => {
					if (v.imageIndex !== undefined && v.imageIndex !== null && images[v.imageIndex]) {
						v.imageReference = {
							url: images[v.imageIndex].url,
							public_id: images[v.imageIndex].public_id
						};
					}
					delete v.imageIndex; // Lo borramos para que Mongoose no chille
					return v;
				});
			}

			// Subir og_image a Cloudinary si se proporcionó
			let seoData: any = data.seo || {};
			if (ogImageFile) {
				const uploaded = await ImageService.UploadImage(
					ogImageFile,
					`${data.brand}-${data.model}-og`,
					`${tenantSlug}/seo-images`
				);
				seoData = {
					...seoData,
					og_image: {
						url: uploaded.secure_url,
						public_id: uploaded.public_id
					}
				};
			}

			// Elegir modelo según el tipo de producto
			const Model = this.getModel(models, data.productType);


			// Campos comunes
			const baseData: any = {
				slug,
				provider: data.provider || '',
				brand: data.brand,
				shortDescription: this.sanitizeDescription(data.shortDescription),
				largeDescription: this.sanitizeDescription(data.largeDescription),
				model: data.model,
				category: data.category,
				features: data.features,
				customProfitMargin: data.customProfitMargin !== undefined ? data.customProfitMargin : undefined,
				prices,
				images,
				specifications: data.specifications,
				variants: data.variants || [],
				tags: data.tags || [],
				seo: seoData
			};

			// Campos específicos de tech
			if (data.productType === ProductType.TECH) {
				if (data.storage) baseData.storage = data.storage;
				if (data.ram) baseData.ram = data.ram;
				if (data.processor) baseData.processor = data.processor;
				if (data.screenSize) baseData.screenSize = data.screenSize;
				if (data.os) baseData.os = data.os;
			}

			// Campos específicos de ropa
			if (data.productType === ProductType.CLOTHING) {
				if (data.gender) baseData.gender = data.gender;
				if (data.fit) baseData.fit = data.fit;
				if (data.material) baseData.material = data.material;
				if (data.composition) baseData.composition = data.composition;
				if (data.sizeType) baseData.sizeType = data.sizeType;
				if (data.careInstructions) baseData.careInstructions = data.careInstructions;
				if (data.season) baseData.season = data.season;
			}

			const newProduct = await Model.create(baseData)
			await newProduct.populate('provider');
			return newProduct.toObject() as unknown as IProduct;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create product', 'Error al crear el producto', 500);
		}
	}

	// ============ UPDATE ============

	static async updateProductById(models: TenantModels, id: string, updateData: Partial<IProductUpdateDTO>, files: Express.Multer.File[], ogImageFile: Express.Multer.File | null, tenantSlug: string = 'general'): Promise<IProduct> {
		console.log('updateProductById');
		console.log('Data:');
		console.log(updateData);
		try {
			const imagesToDelete = JSON.parse((updateData.deletedImages || '[]') as string) as string[];

			// Traemos +prices.costPrice explícitamente (select: false en el schema).
			// Es necesario como fallback cuando el admin solo cambia customProfitMargin
			// sin enviar un price nuevo — evita calcular con costPrice undefined.
			const product = await models.Product.findById(id)
				.select('+provider +prices.costPrice +prices.dolarPrice +prices.profitMargin +prices.baseCommission +prices.cft6Cuotas +prices.profitMargin1Pay +prices.profitMarginInstallments')
				.populate('provider')
				.lean() as unknown as IProduct;

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

			const imagesOrderStr = (updateData as any).imagesOrder;

			if (files && files.length > 0) {
				const brand = updateData.brand || product.brand;
				const model = updateData.model || product.model;

				const rawImages = files.map((file) => ({
					id: `${brand}-${model}`,
					source: file
				}));

				const newImages = await ImageService.UploadImages(rawImages, `${tenantSlug}/product-images`);
				updateData.images = [...currentImages, ...newImages];
			} else if (imagesToDelete.length > 0 || imagesOrderStr) {
				updateData.images = currentImages;
			}

			if (imagesOrderStr && updateData.images) {
				try {
					const orderArray = JSON.parse(imagesOrderStr as string) as string[];
					if (orderArray.length > 0) {
						updateData.images.sort((a: any, b: any) => {
							const urlA = a.url || a.secure_url;
							const urlB = b.url || b.secure_url;
							const idxA = orderArray.indexOf(urlA);
							const idxB = orderArray.indexOf(urlB);

							if (idxA === -1 && idxB === -1) return 0;
							if (idxA === -1) return 1;
							if (idxB === -1) return -1;

							return idxA - idxB;
						});
					}
				} catch (error) {
					console.error('Error parsing imagesOrder', error);
				}
			}

			if (updateData.brand || updateData.model) {
				const newBrand = updateData.brand || product.brand;
				const newModel = updateData.model || product.model;
				updateData.slug = this.generateSlug(newBrand, newModel);
			}

			if (updateData.price || updateData.customProfitMargin1Pay !== undefined || updateData.customProfitMarginInstallments !== undefined) {
				const { venta } = await getDolar();
				const currentCustomProfitMargin = updateData.customProfitMargin !== undefined ? updateData.customProfitMargin : product.prices.profitMargin;
				const currentProfitMargin1Pay = updateData.customProfitMargin1Pay !== undefined ? updateData.customProfitMargin1Pay : product.prices.profitMargin1Pay;
				const currentProfitMarginInstallments = updateData.customProfitMarginInstallments !== undefined ? updateData.customProfitMarginInstallments : product.prices.profitMarginInstallments;

				// Attempt to get the current base price. If updateData.price is provided, use it.
				// Otherwise try temporary product.price. As a final fallback, safely cast the stored base price cost
				const currentPrice = updateData.price !== undefined
					? updateData.price
					: product.prices.costPrice.inUSD;

				const prices = await PaymentService.CalculatePrices(
					{
						paymentProvider: EcommercePaymentProviders.MERCADOPAGO,
						cost_price: currentPrice as number,
						dolar: venta,
						models,
						customProfitMargin: currentCustomProfitMargin,
						customProfitMargin1Pay: currentProfitMargin1Pay,
						customProfitMarginInstallments: currentProfitMarginInstallments
					}
				);
				updateData.prices = prices;
				if (updateData.customProfitMargin1Pay) updateData.prices.profitMargin1Pay = Number(updateData.customProfitMargin1Pay);
				if (updateData.customProfitMarginInstallments) updateData.prices.profitMarginInstallments = Number(updateData.customProfitMarginInstallments);
			};
			if (updateData.specifications) updateData.specifications = JSON.parse(updateData.specifications as string);
			if (updateData.storage) updateData.storage = JSON.parse(updateData.storage as string);
			if (updateData.features) updateData.features = JSON.parse(updateData.features as string);
			if (updateData.provider) updateData.provider = updateData.provider;
			if (updateData.variants) {
				const parsedVariants = JSON.parse(updateData.variants as string);
				updateData.variants = parsedVariants.map((v: any) => {
					// Si el front nos mandó un imageIndex y tenemos fotos en el array final...
					if (v.imageIndex !== undefined && v.imageIndex !== null && updateData.images && updateData.images[v.imageIndex]) {
						v.imageReference = {
							url: updateData.images[v.imageIndex].url,
							public_id: updateData.images[v.imageIndex].public_id
						};
					} else if (v.imageIndex !== undefined && !updateData.images) {
						const imgSelected = product.images.at(v.imageIndex);
						if (imgSelected) {
							v.imageReference = {
								url: imgSelected.url,
								public_id: imgSelected.public_id
							};
						}
					}
					delete v.imageIndex; // Limpiar basura
					return v;
				});
				// Le casteamos los dos tipos posibles para que haga match con el DTO
				// updateData.variants = parsedVariants as ITechVariant[] | IClothingVariant[];
			}
			if (updateData.tags) updateData.tags = JSON.parse(updateData.tags as string);
			if (updateData.careInstructions) updateData.careInstructions = JSON.parse(updateData.careInstructions as string);
			if (updateData.composition) updateData.composition = JSON.parse(updateData.composition as string);
			if (updateData.season) updateData.season = JSON.parse(updateData.season as string);
			// Parsear SEO si viene como JSON string
			if (updateData.seo) updateData.seo = JSON.parse(updateData.seo as unknown as string);

			// Manejar og_image del SEO
			const deletedOgImageId = (updateData as any).deletedSeoOgImage as string | undefined;
			if (deletedOgImageId) {
				await ImageService.DeleteImage(deletedOgImageId);
				updateData.seo = { ...(updateData.seo || {}), og_image: { url: '', public_id: '' } } as any;
			}
			if (ogImageFile) {
				const brand = updateData.brand || product.brand;
				const model = updateData.model || product.model;
				const uploaded = await ImageService.UploadImage(
					ogImageFile,
					`${brand}-${model}-og`,
					`${tenantSlug}/seo-images`
				);
				updateData.seo = {
					...(updateData.seo || {}),
					metaImage: {
						url: uploaded.secure_url,
						public_id: uploaded.public_id
					}
				} as any;
			}

			const fieldsToSelect = Object.keys(updateData).join(' ') + (updateData.slug ? ' slug' : '');

			console.log('Fields To Select');
			console.log(fieldsToSelect);
			console.log('Parsed data');
			console.log(updateData);
			const TargetModel = product.productType === ProductType.TECH
				? (models.TechProduct || models.Product.discriminators?.[ProductType.TECH])
				: (models.ClothingProduct || models.Product.discriminators?.[ProductType.CLOTHING]);

			if (!TargetModel) {
				throw new AppError('Internal Server Error', 'No se encontró el modelo discriminador', 500);
			}

			console.log(`Aplicando update sobre el modelo estricto: ${TargetModel.modelName}`);

			// 2. Ejecutamos la actualización sobre el TargetModel en vez de models.Product
			const updatedProduct = await TargetModel.findByIdAndUpdate(
				id,
				{ $set: updateData },
				{
					new: true,
					runValidators: true,
					select: fieldsToSelect,
					populate: 'provider'
				}
			).lean();


			if (!updatedProduct) {
				throw new AppError('Error updating product', 'No se pudo actualizar el producto', 404);
			}
			return updatedProduct as unknown as IProduct;
		} catch (error) {
			console.log(error);
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
		items: { _id: string; sku: string; quantity: number }[]
	): Promise<boolean> {
		try {
			for (const item of items) {
				const product = await models.Product.findById(item._id).lean() as any;
				if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);

				const variant = product.variants.find(
					(v: any) => v.sku === item.sku && v.isActive
				);

				if (!variant) {
					throw new AppError(
						`Variant ${item.sku} not found`,
						`Variante ${item.sku} no encontrada o inactiva`,
						404
					);
				}

				const availableStock = variant.stock - variant.reservedStock;
				if (availableStock < item.quantity) {
					throw new AppError(
						`Insufficient stock for variant ${item.sku}`,
						`Stock insuficiente para la variante ${item.sku}`,
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
		items: { _id: string; sku: string; quantity: number }[]
	): Promise<boolean> {
		try {
			const operations = items.map((item) => ({
				updateOne: {
					filter: {
						// Transformamos el string a ObjectId manualmente para el driver nativo
						_id: new Types.ObjectId(item._id),
						'variants.sku': item.sku,
						'variants.stock': { $gte: item.quantity }
					},
					update: {
						$inc: {
							'variants.$[elem].stock': -item.quantity
						}
					},
					arrayFilters: [{ 'elem.sku': item.sku }]
				}
			}));

			// MAGIA: models.Product.collection salta el filtro restrictivo del Schema Base
			const result = await models.Product.collection.bulkWrite(operations, { ordered: true });

			if (result.modifiedCount !== items.length) {
				throw new AppError(
					'Stock reduction failed for one or more variants',
					'No se pudo reducir el stock de una o más variantes',
					400
				);
			}

			return true;
		} catch (error) {
			console.log(error);
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
				// Usamos .collection para bypassear el Strict Mode del Schema Base
				await models.Product.collection.findOneAndUpdate(
					{
						_id: new Types.ObjectId(item.product.toString()),
						'variants.sku': item.variantSku
					},
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

	static async getProviderProducts(models: TenantModels, providerId: string) {
		try {
			const products = await models.Product.find({ provider: providerId });
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to fetch provider products',
				'Error al obtener los productos del proveedor',
				500
			);
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
