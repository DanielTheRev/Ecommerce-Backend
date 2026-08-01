import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { ClothingGender, IProduct, IProductCreateDTO, IProductUpdateDTO, ISizeGuide, ProductType } from '@/interfaces/product.interface';
import { paginate } from '@/utils/pagination.util';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { Types } from 'mongoose';
import slugify from 'slugify';
import { getDolar } from './dolar.service';
import { ImageService } from './images.service';
import { PaymentService } from './Payment.service';
import { FinanceService } from './finance.service';
import { SkuService } from './sku.service';
import { EcommerceService, DEFAULT_RECOMMENDATION_RULES } from './ecommerce.service';


export class ProductService {
	private constructor() { }

	private static purifyConfig = {
		ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'span'],
		ALLOWED_ATTR: ['href', 'target', 'class'],
		ALLOW_DATA_ATTR: false,
	};

	public static readonly CATEGORY_GROUPS: Record<string, string[]> = {
		abrigos: ['Abrigos', 'Camperas', 'Poleras', 'Buzos', 'Sweaters', 'Chaquetas', 'Tapados', 'Parkas', 'Chalecos', 'Abrigo', 'Campera', 'Buzo', 'Polera', 'Sweater'],
		pantalones: ['Pantalones', 'Denim', 'Jeans', 'Baggies', 'Bermudas', 'Shorts', 'Pantalón', 'Pantalon', 'Joggers', 'Cargo', 'Jean', 'Short', 'Baggy'],
		remeras: ['Remeras', 'Remera', 'T-Shirts', 'T-Shirt', 'Tops', 'Top', 'Musculosas', 'Musculosa'],
		calzado: ['Calzado', 'Zapatillas', 'Zapatos', 'Botas', 'Mule', 'Ojotas', 'Sandalias', 'Zapatilla', 'Zapato', 'Bota']
	};

	public static buildCategoryQuery(categoryParam: string): any {
		const rawCategories = categoryParam.split(',').map(c => c.trim()).filter(Boolean);
		const expandedCategories = new Set<string>();

		for (const cat of rawCategories) {
			const lowerKey = cat.toLowerCase();
			if (this.CATEGORY_GROUPS[lowerKey]) {
				this.CATEGORY_GROUPS[lowerKey].forEach(c => expandedCategories.add(c));
			} else {
				expandedCategories.add(cat);
			}
		}

		const catList = Array.from(expandedCategories);
		const regexes = catList.map(c => new RegExp(`^${c}$`, 'i'));

		if (regexes.length === 1) {
			return regexes[0];
		}
		return { $in: regexes };
	}

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

	static async getAllProducts(models: TenantModels, productType?: string, isActive: boolean = true): Promise<IProduct[]> {
		try {
			const Model = this.getModel(models, productType);
			const query: any = {};
			if (isActive) {
				query.isActive = true;
			}
			const products = (await Model.find(query).lean()) as unknown as IProduct[];
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
				.select('+provider +finance')
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
			}).select('+provider +finance')
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

				if (product.isActive === false) {
					throw new AppError(
						`Product ${product.brand} ${product.model} is inactive`,
						`El producto ${product.brand} ${product.model} está inactivo`,
						400
					);
				}

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
						price: product.price,
						finance: product.finance,
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
			}).select('+finance')
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
			const products = await models.Product.find({ isActive: true }).select('slug -_id -productType').lean() as unknown as { slug: string }[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product slugs', 'Error al obtener los slugs de los productos', 500);
		}
	}

	static async getPaginatedProducts(models: TenantModels, page: number = 1, limit: number = 20, productType?: string, category?: string) {
		try {
			const Model = this.getModel(models, productType);
			const query: any = { isActive: true };
			if (category) {
				query.category = category;
			}
			const result = await paginate(Model, query, {
				page,
				limit,
				sort: { 'price.cashTransferPrice': -1 }
			});
			return result;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch paginated products', 'Error al obtener los productos', 500);
		}
	}

	static async getPaginatedProductsWCompletePrices(
		models: TenantModels,
		page: number = 1,
		limit: number = 10,
		productType?: string,
		q?: string,
		category?: string,
		isActive?: boolean,
		providerId?: string,
		hasSizeGuide?: boolean,
		hasSeoImage?: boolean
	) {
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
				query.category = this.buildCategoryQuery(category);
			}
			if (isActive !== undefined) {
				query.isActive = isActive;
			}

			if (providerId) {
				query.provider = providerId;
			}

			if (hasSizeGuide !== undefined) {
				if (hasSizeGuide) {
					query['sizeGuide.rows.0'] = { $exists: true };
				} else {
					query.$or = [
						{ sizeGuide: { $exists: false } },
						{ 'sizeGuide.rows': { $size: 0 } },
						{ 'sizeGuide.rows': { $exists: false } }
					];
				}
			}

			if (hasSeoImage !== undefined) {
				if (hasSeoImage) {
					query['seo.metaImage.url'] = { $exists: true, $ne: '' };
				} else {
					query.$or = [
						{ seo: { $exists: false } },
						{ 'seo.metaImage': { $exists: false } },
						{ 'seo.metaImage.url': { $exists: false } },
						{ 'seo.metaImage.url': '' }
					];
				}
			}

			const result = await paginate(Model, query, {
				page,
				limit,
				sort: { 'createdAt': -1 },
				select: '+provider +finance',
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

	static async getQualityAudit(models: TenantModels) {
		try {
			const products = (await models.Product.find({ isActive: true })
				.select('_id brand model category slug productType seo sizeGuide images')
				.lean()) as unknown as any[];

			const clothingProducts = products.filter(p => p.productType === ProductType.CLOTHING);

			const withSizeGuide = clothingProducts.filter(
				p => p.sizeGuide && Array.isArray(p.sizeGuide.rows) && p.sizeGuide.rows.length > 0
			);
			const withoutSizeGuide = clothingProducts.filter(
				p => !p.sizeGuide || !Array.isArray(p.sizeGuide.rows) || p.sizeGuide.rows.length === 0
			);

			const withSeoImage = products.filter(
				p => p.seo && p.seo.metaImage && typeof p.seo.metaImage.url === 'string' && p.seo.metaImage.url.trim() !== ''
			);
			const withoutSeoImage = products.filter(
				p => !p.seo || !p.seo.metaImage || !p.seo.metaImage.url || p.seo.metaImage.url.trim() === ''
			);

			return {
				summary: {
					totalProducts: products.length,
					totalClothingProducts: clothingProducts.length,
					withSizeGuideCount: withSizeGuide.length,
					withoutSizeGuideCount: withoutSizeGuide.length,
					withSeoImageCount: withSeoImage.length,
					withoutSeoImageCount: withoutSeoImage.length,
				},
				withoutSizeGuide: withoutSizeGuide.map(p => ({
					_id: p._id,
					brand: p.brand,
					model: p.model,
					category: p.category,
					slug: p.slug
				})),
				withSizeGuide: withSizeGuide.map(p => ({
					_id: p._id,
					brand: p.brand,
					model: p.model,
					category: p.category,
					slug: p.slug
				})),
				withoutSeoImage: withoutSeoImage.map(p => ({
					_id: p._id,
					brand: p.brand,
					model: p.model,
					category: p.category,
					slug: p.slug,
					productType: p.productType
				})),
				withSeoImage: withSeoImage.map(p => ({
					_id: p._id,
					brand: p.brand,
					model: p.model,
					category: p.category,
					slug: p.slug,
					productType: p.productType,
					metaImageUrl: p.seo.metaImage.url
				}))
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to get quality audit', 'Error al obtener auditoría de calidad', 500);
		}
	}

	static async getProductBySlug(models: TenantModels, slug: string): Promise<IProduct> {
		try {
			const product = (await models.Product.findOne({ slug, isActive: true }).lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product by slug', 'Error al obtener el producto', 500);
		}
	}

	static async getRecommendationsForProduct(
		models: TenantModels,
		slug: string,
		limitOverride?: number
	): Promise<IProduct[]> {
		try {
			// 1. Obtener producto origen
			const sourceProduct = (await models.Product.findOne({ slug, isActive: true }).lean()) as unknown as IProduct;
			if (!sourceProduct) {
				throw new AppError('Product not found', 'Producto no encontrado', 404);
			}

			// 2. Obtener configuración del e-commerce
			const config = await EcommerceService.getConfig(models).catch(() => null);
			const recommendationConfig = config?.recommendationConfig;
			const limit = limitOverride || recommendationConfig?.limit || 8;
			const customRules = recommendationConfig?.rules || {};

			// 3. Determinar categorías objetivo
			let targetCategories: string[] = [];

			if (customRules[sourceProduct.category] && Array.isArray(customRules[sourceProduct.category]) && customRules[sourceProduct.category].length > 0) {
				targetCategories = customRules[sourceProduct.category];
			} else {
				const normalizedCatKey = sourceProduct.category
					.toLowerCase()
					.trim()
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '');

				if (DEFAULT_RECOMMENDATION_RULES[normalizedCatKey]) {
					targetCategories = DEFAULT_RECOMMENDATION_RULES[normalizedCatKey];
				} else {
					const matchedKey = Object.keys(DEFAULT_RECOMMENDATION_RULES).find(key => normalizedCatKey.includes(key));
					if (matchedKey) {
						targetCategories = DEFAULT_RECOMMENDATION_RULES[matchedKey];
					} else {
						const allCategories = (await models.Product.distinct('category', { isActive: true })) as string[];
						targetCategories = allCategories.filter((c: string) => c !== sourceProduct.category);
						targetCategories.push(sourceProduct.category);
					}
				}
			}

			// 4. Construir filtro por Género (para indumentaria)
			const genderFilter: any = {};
			const rawSource = sourceProduct as any;
			if (sourceProduct.productType === ProductType.CLOTHING && rawSource.gender) {
				if (rawSource.gender !== ClothingGender.Unisex) {
					genderFilter.gender = { $in: [rawSource.gender, ClothingGender.Unisex] };
				}
			}

			const excludeIds = [sourceProduct._id.toString()];
			const recommendations: IProduct[] = [];
			const selectedIdsSet = new Set<string>(excludeIds);

			// 5. Intercalar productos entre las categorías objetivo para máxima variedad
			for (const cat of targetCategories) {
				if (recommendations.length >= limit) break;

				const remainingLimit = limit - recommendations.length;
				const remainingCategories = targetCategories.length - targetCategories.indexOf(cat);
				const perCatLimit = Math.max(1, Math.ceil(remainingLimit / Math.max(1, remainingCategories)));

				const query: any = {
					isActive: true,
					category: cat,
					_id: { $nin: Array.from(selectedIdsSet).map(id => new Types.ObjectId(id)) },
					...genderFilter
				};

				const catProducts = (await models.Product.find(query)
					.sort({ isFeatured: -1, 'price.cashTransferPrice': -1 })
					.limit(perCatLimit)
					.lean()) as unknown as IProduct[];

				for (const p of catProducts) {
					if (recommendations.length >= limit) break;
					const pId = p._id.toString();
					if (!selectedIdsSet.has(pId)) {
						selectedIdsSet.add(pId);
						recommendations.push(p);
					}
				}
			}

			// 6. Fallback final si faltan productos para completar el limit
			if (recommendations.length < limit) {
				const remainingCount = limit - recommendations.length;
				const fallbackQuery: any = {
					isActive: true,
					_id: { $nin: Array.from(selectedIdsSet).map(id => new Types.ObjectId(id)) },
					productType: sourceProduct.productType,
					...genderFilter
				};

				const fallbackProducts = (await models.Product.find(fallbackQuery)
					.sort({ isFeatured: -1, createdAt: -1 })
					.limit(remainingCount)
					.lean()) as unknown as IProduct[];

				for (const p of fallbackProducts) {
					if (recommendations.length >= limit) break;
					const pId = p._id.toString();
					if (!selectedIdsSet.has(pId)) {
						selectedIdsSet.add(pId);
						recommendations.push(p);
					}
				}
			}

			return recommendations;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch recommendations', 'Error al obtener las recomendaciones', 500);
		}
	}

	static async getSearchSuggestions(models: TenantModels, queryText: string, limit: number = 10, productType?: string): Promise<IProduct[]> {
		try {
			const Model = this.getModel(models, productType);
			const query = {
				isActive: true,
				$or: [
					{ brand: { $regex: queryText, $options: 'i' } },
					{ model: { $regex: queryText, $options: 'i' } }
				]
			};
			const products = await Model.find(query)
				.sort({ 'price.cashTransferPrice': -1 })
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
		data: {
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
				sortBy?: 'createdAt' | 'price' | string;
				sortOrder?: 'asc' | 'desc' | string;
			},
			page?: number,
			limit?: number,
			productType?: string
		}
	) {
		const { models, filters, page = 1, limit = 10, productType } = data;
		try {
			const Model = this.getModel(models, productType);
			const query: any = {};

			query.isActive = true

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
				query['price.cashTransferPrice'] = {};
				if (filters.minPrice) query['price.cashTransferPrice'].$gte = filters.minPrice;
				if (filters.maxPrice) query['price.cashTransferPrice'].$lte = filters.maxPrice;
			}

			if (filters.minRating) {
				query.rating = { $gte: filters.minRating };
			}

			if (filters.category) {
				query.category = ProductService.buildCategoryQuery(filters.category);
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

			const sortField = filters.sortBy === 'createdAt' ? 'createdAt' :
				filters.sortBy === 'price' ? 'price.cashTransferPrice' :
					'price.cashTransferPrice';
			const sortDirection = filters.sortOrder === 'desc' ? 1 : -1;
			const result = await paginate(Model, query, {
				page,
				limit,
				sort: { [sortField]: sortDirection }
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

			const additionalCosts = typeof data.additionalCosts === 'string'
				? JSON.parse(data.additionalCosts)
				: data.additionalCosts;

			const discountPercentageTransfer = data.discountPercentageTransfer !== undefined
				? Number(data.discountPercentageTransfer)
				: undefined;

			const { price, finance } = await FinanceService.CalculatePrices(
				{
					providerCost: data.providerCost !== undefined ? data.providerCost : data.price!,
					additionalCosts: additionalCosts || [],
					discountPercentageTransfer,
					dolar: venta,
					models,
					useCustomProfit: data.useCustomProfit ?? (data.customProfitMargin !== undefined && data.customProfitMargin !== null && !isNaN(Number(data.customProfitMargin))),
					customProfitMargin: data.customProfitMargin !== undefined && data.customProfitMargin !== null && !isNaN(Number(data.customProfitMargin)) ? Number(data.customProfitMargin) : undefined,
					pricingMethodChoice: data.pricingMethodChoice,
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
					delete v.sku; // Ignorar SKU del frontend — lo genera el backend
					return v;
				});

				// ── Auto-generar SKUs para todas las variantes ──
				data.variants = await SkuService.generateSkusForVariants(
					models,
					data.variants as any[],
					data.category,
					data.productType,
					data.brand
				);
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

				price,
				finance,
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
				if (data.sizeGuide) baseData.sizeGuide = typeof data.sizeGuide === 'string' ? JSON.parse(data.sizeGuide) : data.sizeGuide;
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

	/**
	 * Recalcula masivamente los precios de todos los productos basándose en una nueva configuración.
	 * Utiliza bulkWrite para mayor eficiencia en la base de datos.
	 */
	static async recalculateAllProductsPrices(models: TenantModels, config: any): Promise<void> {
		try {
			console.log('🔄 Iniciando recalculo masivo de precios...');
			// Obtenemos todos los productos. Necesitamos los campos del precio base.
			const products = await models.Product.find({})
				.select('+finance')
				.lean() as unknown as IProduct[];

			if (!products || products.length === 0) {
				console.log('No hay productos para recalcular.');
				return;
			}

			const { venta: dolarVenta } = await getDolar();
			const isARS = config.costCurrency === 'ARS';
			const bulkOps = [];

			for (const product of products) {
				// Buscar costo del proveedor anterior
				let baseCost = 0;
				let additionalCosts: any[] = [];
				let customProfitMargin = undefined;
				let pricingMethodChoice: any = undefined;
				let discountPercentageTransfer: number | undefined = undefined;

				const rawProduct = product as any;
				const oldPrices = rawProduct.prices || rawProduct.price;

				if (product.finance?.providerCost) {
					baseCost = isARS ? product.finance.providerCost.inARS : product.finance.providerCost.inUSD;
					additionalCosts = product.finance.additionalCosts || [];
					customProfitMargin = product.finance.pricingStrategy?.targetProfit;
					pricingMethodChoice = product.finance.pricingStrategy?.method;
					discountPercentageTransfer = product.price?.discountPercentageTransfer;
				} else if (oldPrices) {
					// Fallback a campos viejos de prices/price
					baseCost = isARS 
						? (oldPrices.costPrice?.inARS || oldPrices.providerCost?.inARS || 0) 
						: (oldPrices.costPrice?.inUSD || oldPrices.providerCost?.inUSD || 0);

					// Si el costo sigue siendo 0, tal vez el precio base era directo
					if (baseCost === 0 && typeof oldPrices === 'number') {
						baseCost = oldPrices;
					}
					pricingMethodChoice = oldPrices.customPricingMethod;
					customProfitMargin = oldPrices.profitMargin;
				}

				if (!baseCost) {
					// Si de plano no tiene costo base, omitimos para evitar divisiones por cero
					continue;
				}

				// Recalcular los precios usando la nueva configuración inyectada
				const { price: calculatedPrice, finance: calculatedFinance } = await FinanceService.CalculatePrices({
					providerCost: baseCost,
					additionalCosts,
					discountPercentageTransfer,
					dolar: dolarVenta,
					models,
					config, // Pasamos la configuración para evitar múltiples queries
					useCustomProfit: customProfitMargin !== undefined,
					customProfitMargin,
					pricingMethodChoice,
				});

				// Preparar la operación de actualización para MongoDB (incluye el borrado del campo viejo prices)
				bulkOps.push({
					updateOne: {
						filter: { _id: product._id },
						update: { 
							$set: { price: calculatedPrice, finance: calculatedFinance },
							$unset: { prices: "" }
						}
					}
				});
			}

			// Ejecutar todas las actualizaciones de una vez
			if (bulkOps.length > 0) {
				const result = await models.Product.bulkWrite(bulkOps);
				console.log(`✅ Recalculo masivo completado. Productos actualizados: ${result.modifiedCount}`);
			}
		} catch (error) {
			console.error('❌ Error en recalculo masivo:', error);
			// No lanzamos error para no bloquear el flujo principal de updateConfig
		}
	}

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
				.select('+provider +finance')
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

			if (
				updateData.providerCost !== undefined ||
				updateData.price !== undefined || 
				updateData.useCustomProfit !== undefined ||
				updateData.customProfitMargin !== undefined || 
				updateData.pricingMethodChoice !== undefined ||
				updateData.additionalCosts !== undefined ||
				updateData.discountPercentageTransfer !== undefined
			) {
				const { venta } = await getDolar();
				const currentCustomProfitMargin = updateData.customProfitMargin !== undefined ? updateData.customProfitMargin : product.finance?.pricingStrategy?.targetProfit;

				// Attempt to get the current base price. If updateData.providerCost or updateData.price is provided, use it.
				// Otherwise try temporary product.price. As a final fallback, safely cast the stored base price cost
				const config = await EcommerceService.getConfig(models);
				const isARS = config.costCurrency === 'ARS';
				const currentPrice = updateData.providerCost !== undefined
					? updateData.providerCost
					: (updateData.price !== undefined
						? updateData.price
						: (isARS ? product.finance?.providerCost?.inARS : product.finance?.providerCost?.inUSD));

				const newAdditionalCosts = updateData.additionalCosts !== undefined
					? (typeof updateData.additionalCosts === 'string' ? JSON.parse(updateData.additionalCosts) : updateData.additionalCosts)
					: (product.finance?.additionalCosts || []);

				const newDiscountPercentageTransfer = updateData.discountPercentageTransfer !== undefined
					? Number(updateData.discountPercentageTransfer)
					: product.price?.discountPercentageTransfer;

				const { price, finance } = await FinanceService.CalculatePrices(
					{
						providerCost: currentPrice as number,
						additionalCosts: newAdditionalCosts,
						discountPercentageTransfer: newDiscountPercentageTransfer,
						dolar: venta,
						models,
						useCustomProfit: updateData.useCustomProfit ?? (product.finance?.pricingStrategy?.targetProfit !== undefined),
						customProfitMargin: currentCustomProfitMargin,
						pricingMethodChoice: updateData.pricingMethodChoice ?? product.finance?.pricingStrategy?.method,
					}
				);
				(updateData as any).price = price;
				(updateData as any).finance = finance;
				delete (updateData as any).prices;
				delete (updateData as any).providerCost;
				delete updateData.additionalCosts;
				delete updateData.discountPercentageTransfer;
			};
			if (updateData.specifications) updateData.specifications = JSON.parse(updateData.specifications as string);
			if (updateData.storage) updateData.storage = JSON.parse(updateData.storage as string);
			if (updateData.features) updateData.features = JSON.parse(updateData.features as string);
			if (updateData.provider) updateData.provider = updateData.provider;
			if (updateData.variants) {
				const parsedVariants = JSON.parse(updateData.variants as string);
				let processedVariants = parsedVariants.map((v: any) => {
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

				/* Sizes Guide */
				if(updateData.sizeGuide) updateData.sizeGuide = JSON.parse(updateData.sizeGuide as string) as ISizeGuide;

				const dbVariants = (product.variants || []) as any[];

				// ── Matchear variantes enviadas con las existentes en DB para preservar _id y SKU ──
				processedVariants = processedVariants.map((v: any) => {
					let match: any = null;

					if (v._id) {
						match = dbVariants.find(dbV => dbV._id.toString() === v._id.toString());
					}
					if (!match && v.sku) {
						match = dbVariants.find(dbV => dbV.sku === v.sku);
					}
					if (!match) {
						const colorName = v.color?.name?.toLowerCase().trim();
						if (product.productType === ProductType.CLOTHING && v.size) {
							const size = String(v.size).toLowerCase().trim();
							match = dbVariants.find(dbV => {
								const dbColor = dbV.color?.name?.toLowerCase().trim();
								const dbSize = String(dbV.size || '').toLowerCase().trim();
								return dbSize === size && (!colorName || dbColor === colorName);
							});
						} else if (product.productType === ProductType.TECH && v.attributes) {
							match = dbVariants.find(dbV => {
								const dbColor = dbV.color?.name?.toLowerCase().trim();
								const dbColorMatch = !colorName || dbColor === colorName;
								const dbAttrsStr = JSON.stringify(dbV.attributes || []);
								const vAttrsStr = JSON.stringify(v.attributes || []);
								return dbColorMatch && dbAttrsStr === vAttrsStr;
							});
						}
					}

					if (match) {
						v._id = match._id;
						v.sku = match.sku;
					}

					return v;
				});

				// ── Auto-generar SKUs solo para variantes verdaderamente NUEVAS ──
				const existingVariants = processedVariants.filter((v: any) => v._id || v.sku);
				const newVariants = processedVariants.filter((v: any) => !v._id && !v.sku);

				if (newVariants.length > 0) {
					newVariants.forEach((v: any) => delete v.sku);

					// Reutilizar la secuencia existente del producto (extraída del primer SKU válido)
					let existingSequence: number | undefined;
					for (const extV of dbVariants) {
						if (extV.sku) {
							const seq = SkuService.extractSequenceFromSku(extV.sku);
							if (seq !== null) {
								existingSequence = seq;
								break;
							}
						}
					}

					const category = (updateData.category as string) || product.category;
					const brand = (updateData.brand as string) || product.brand;

					const generated = await SkuService.generateSkusForVariants(
						models,
						newVariants,
						category,
						product.productType as ProductType,
						brand,
						existingSequence
					);

					updateData.variants = [...existingVariants, ...generated] as any;
				} else {
					updateData.variants = processedVariants as any;
				}
			}
			if (updateData.tags) updateData.tags = JSON.parse(updateData.tags as string);
			if (updateData.careInstructions) updateData.careInstructions = JSON.parse(updateData.careInstructions as string);
			if (updateData.composition) updateData.composition = JSON.parse(updateData.composition as string);
			if (updateData.sizeGuide) updateData.sizeGuide = typeof updateData.sizeGuide === 'string' ? JSON.parse(updateData.sizeGuide) : updateData.sizeGuide;
			if (updateData.season) updateData.season = updateData.season as string;
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

			// Construir la operación de update
			const updateOp: any = { $set: updateData };

			// Si sizeGuide es null, lo removemos del documento con $unset
			if ((updateData as any).sizeGuide === null) {
				delete (updateData as any).sizeGuide;
				updateOp.$unset = { sizeGuide: '' };
			}

			// 2. Ejecutamos la actualización sobre el TargetModel en vez de models.Product
			const updatedProduct = await TargetModel.findByIdAndUpdate(
				id,
				updateOp,
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

	static async bulkUpdateStatus(models: TenantModels, ids: string[], isActive: boolean): Promise<boolean> {
		try {
			await models.Product.updateMany(
				{ _id: { $in: ids.map(id => new Types.ObjectId(id)) } },
				{ $set: { isActive } }
			);
			return true;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to bulk update product status',
				'Error al actualizar el estado masivo de los productos',
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
