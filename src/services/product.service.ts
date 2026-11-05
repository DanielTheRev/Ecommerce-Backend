import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders } from '@/interfaces/ecommerce.interface';
import { ClothingGender, ClothingSizeType, IProduct, IProductCreateDTO, IProductUpdateDTO, ISizeGuide, ProductType, ProductStatus } from '@/interfaces/product.interface';
import { paginate } from '@/utils/pagination.util';
import { escapeRegex } from '@/utils/regex.util';
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
import { CategoryGroupService } from './categoryGroup.service';
import { ICategoryGroup } from '@/interfaces/categoryGroup.interface';
import { PushNotificationService } from './pushNotification.service';
import { IVisitorInfo } from '@/utils/deviceDetector';
import { isProductTypeAllowed, getAllowedProductTypes } from '@/config/verticalCapabilities';
import { getProductModel } from './product/productModel.helper';
import { ProductDisplayService } from './product/productDisplay.service';
import { ProductRankingService } from './product/productRanking.service';
import { ProductInventoryService } from './product/productInventory.service';
import { ProductPricingService } from './product/productPricing.service';
import { ProductSearchService } from './product/productSearch.service';


export class ProductService {
	private constructor() { }

	private static purifyConfig = {
		ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'br', 'span'],
		ALLOWED_ATTR: ['href', 'target', 'class'],
		ALLOW_DATA_ATTR: false,
	};

	public static readonly CATEGORY_GROUPS: Record<string, string[]> = {
		abrigos: [
			'Abrigos', 'Abrigo',
			'Camperas', 'Campera', 'Camperones', 'Camperón', 'Camperon',
			'Poleras', 'Polera', 'Polerones', 'Polerón', 'Poleron', 'Media Polera', 'Medias Poleras',
			'Buzos', 'Buzo', 'Hoodies', 'Hoodie',
			'Sweaters', 'Sweater', 'Suéteres', 'Sueteres', 'Suéter', 'Sueter',
			'Cardigans', 'Cardigan', 'Cárdigans', 'Cárdigan',
			'Chaquetas', 'Chaqueta', 'Tapados', 'Tapado', 'Parkas', 'Parka',
			'Chalecos', 'Chaleco', 'Sacos', 'Saco', 'Blazers', 'Blazer', 'Trench', 'Anoraks', 'Anorak', 'Camisaco', 'Camisacos'
		],
		abrigo: [
			'Abrigos', 'Abrigo',
			'Camperas', 'Campera', 'Camperones', 'Camperón', 'Camperon',
			'Poleras', 'Polera', 'Polerones', 'Polerón', 'Poleron', 'Media Polera', 'Medias Poleras',
			'Buzos', 'Buzo', 'Hoodies', 'Hoodie',
			'Sweaters', 'Sweater', 'Suéteres', 'Sueteres', 'Suéter', 'Sueter',
			'Cardigans', 'Cardigan', 'Cárdigans', 'Cárdigan',
			'Chaquetas', 'Chaqueta', 'Tapados', 'Tapado', 'Parkas', 'Parka',
			'Chalecos', 'Chaleco', 'Sacos', 'Saco', 'Blazers', 'Blazer', 'Trench', 'Anoraks', 'Anorak', 'Camisaco', 'Camisacos'
		],
		sweaters: [
			'Sweaters', 'Sweater', 'Suéteres', 'Sueteres', 'Suéter', 'Sueter',
			'Cardigans', 'Cardigan', 'Cárdigans', 'Cárdigan'
		],
		sueteres: [
			'Sweaters', 'Sweater', 'Suéteres', 'Sueteres', 'Suéter', 'Sueter',
			'Cardigans', 'Cardigan', 'Cárdigans', 'Cárdigan'
		],
		sueter: [
			'Sweaters', 'Sweater', 'Suéteres', 'Sueteres', 'Suéter', 'Sueter',
			'Cardigans', 'Cardigan', 'Cárdigans', 'Cárdigan'
		],
		sweater: [
			'Sweaters', 'Sweater', 'Suéteres', 'Sueteres', 'Suéter', 'Sueter',
			'Cardigans', 'Cardigan', 'Cárdigans', 'Cárdigan'
		],
		buzos: ['Buzos', 'Buzo', 'Hoodies', 'Hoodie'],
		buzo: ['Buzos', 'Buzo', 'Hoodies', 'Hoodie'],
		hoodies: ['Buzos', 'Buzo', 'Hoodies', 'Hoodie'],
		hoodie: ['Buzos', 'Buzo', 'Hoodies', 'Hoodie'],
		poleras: ['Poleras', 'Polera', 'Polerones', 'Polerón', 'Poleron', 'Media Polera', 'Medias Poleras'],
		polera: ['Poleras', 'Polera', 'Polerones', 'Polerón', 'Poleron', 'Media Polera', 'Medias Poleras'],
		camperas: ['Camperas', 'Campera', 'Camperones', 'Camperón', 'Camperon', 'Chaquetas', 'Chaqueta', 'Parkas', 'Parka', 'Tapados', 'Tapado', 'Chalecos', 'Chaleco', 'Anoraks', 'Anorak', 'Camisaco', 'Camisacos'],
		campera: ['Camperas', 'Campera', 'Camperones', 'Camperón', 'Camperon', 'Chaquetas', 'Chaqueta', 'Parkas', 'Parka', 'Tapados', 'Tapado', 'Chalecos', 'Chaleco', 'Anoraks', 'Anorak', 'Camisaco', 'Camisacos'],
		pantalones: [
			'Pantalones', 'Pantalón', 'Pantalon',
			'Joggers', 'Jogger', 'Cargo', 'Cargos', 'Calzas', 'Calza', 'Palazzo', 'Palazzos', 'Slacks'
		],
		pantalon: [
			'Pantalones', 'Pantalón', 'Pantalon',
			'Joggers', 'Jogger', 'Cargo', 'Cargos', 'Calzas', 'Calza', 'Palazzo', 'Palazzos', 'Slacks'
		],
		jeans: ['Jeans', 'Jean', 'Denim', 'Baggies', 'Baggy'],
		jean: ['Jeans', 'Jean', 'Denim', 'Baggies', 'Baggy'],
		denim: ['Jeans', 'Jean', 'Denim', 'Baggies', 'Baggy'],
		shorts: ['Shorts', 'Short', 'Bermudas', 'Bermuda'],
		short: ['Shorts', 'Short', 'Bermudas', 'Bermuda'],
		bermudas: ['Bermudas', 'Bermuda', 'Shorts', 'Short'],
		bermuda: ['Bermudas', 'Bermuda', 'Shorts', 'Short'],
		remeras: ['Remeras', 'Remera', 'T-Shirts', 'T-Shirt', 'Tshirts', 'Tshirt'],
		remera: ['Remeras', 'Remera', 'T-Shirts', 'T-Shirt', 'Tshirts', 'Tshirt'],
		tshirts: ['Remeras', 'Remera', 'T-Shirts', 'T-Shirt', 'Tshirts', 'Tshirt'],
		tshirt: ['Remeras', 'Remera', 'T-Shirts', 'T-Shirt', 'Tshirts', 'Tshirt'],
		musculosas: ['Musculosas', 'Musculosa'],
		musculosa: ['Musculosas', 'Musculosa'],
		tops: ['Tops', 'Top', 'Crop Tops', 'Crop Top'],
		top: ['Tops', 'Top', 'Crop Tops', 'Crop Top'],
		camisas: ['Camisas', 'Camisa', 'Camisolas', 'Camisola'],
		camisa: ['Camisas', 'Camisa', 'Camisolas', 'Camisola'],
		blusas: ['Blusas', 'Blusa', 'Camisas', 'Camisa', 'Camisolas', 'Camisola'],
		blusa: ['Blusas', 'Blusa', 'Camisas', 'Camisa', 'Camisolas', 'Camisola'],
		chombas: ['Chombas', 'Chomba', 'Polos', 'Polo'],
		chomba: ['Chombas', 'Chomba', 'Polos', 'Polo'],
		vestidos: ['Vestidos', 'Vestido', 'Monos', 'Mono', 'Enteritos', 'Enterito', 'Jumpsuits', 'Jumpsuit'],
		vestido: ['Vestidos', 'Vestido', 'Monos', 'Mono', 'Enteritos', 'Enterito', 'Jumpsuits', 'Jumpsuit'],
		calzado: [
			'Calzado', 'Calzados', 'Zapatillas', 'Zapatilla', 'Sneakers', 'Sneaker',
			'Zapatos', 'Zapato', 'Botas', 'Bota', 'Botinetas', 'Botineta', 'Borseguies', 'Borcego', 'Borsegos',
			'Mule', 'Mules', 'Ojotas', 'Ojota', 'Sandalias', 'Sandalia', 'Pantuflas', 'Pantufla'
		],
		calzados: [
			'Calzado', 'Calzados', 'Zapatillas', 'Zapatilla', 'Sneakers', 'Sneaker',
			'Zapatos', 'Zapato', 'Botas', 'Bota', 'Botinetas', 'Botineta', 'Borseguies', 'Borcego', 'Borsegos',
			'Mule', 'Mules', 'Ojotas', 'Ojota', 'Sandalias', 'Sandalia', 'Pantuflas', 'Pantufla'
		],
		zapatillas: ['Zapatillas', 'Zapatilla', 'Sneakers', 'Sneaker'],
		zapatilla: ['Zapatillas', 'Zapatilla', 'Sneakers', 'Sneaker'],
		sneakers: ['Zapatillas', 'Zapatilla', 'Sneakers', 'Sneaker'],
		sneaker: ['Zapatillas', 'Zapatilla', 'Sneakers', 'Sneaker'],
		accesorios: ['Accesorios', 'Accesorio', 'Gorras', 'Gorra', 'Caps', 'Cap', 'Bags', 'Bag', 'Mochilas', 'Mochila', 'Cinturones', 'Cinturón', 'Cinturon', 'Medias', 'Billeteras', 'Billetera'],
		accesorio: ['Accesorios', 'Accesorio', 'Gorras', 'Gorra', 'Caps', 'Cap', 'Bags', 'Bag', 'Mochilas', 'Mochila', 'Cinturones', 'Cinturón', 'Cinturon', 'Medias', 'Billeteras', 'Billetera']
	};

	// ============ SEARCH, DISPLAY & CATEGORY DELEGATIONS ============
	public static buildCategoryQuery = ProductSearchService.buildCategoryQuery;
	public static getApparelZone = ProductDisplayService.getApparelZone;
	public static splitProductsByColor = ProductDisplayService.splitProductsByColor;
	public static interleaveProducts = ProductDisplayService.interleaveProducts;

	// ============ DISCRIMINATOR HELPER ============

	/**
	 * Retorna el modelo correcto según el tipo de producto.
	 * MULTI-TENANT: Usa los modelos registrados en la conexión del tenant.
	 */
	public static getModel = getProductModel;

	// ============ READ METHODS ============

	static async getAllProducts(models: TenantModels, productType?: string, status: string = 'published'): Promise<IProduct[]> {
		try {
			const Model = this.getModel(models, productType);
			const query: any = {};
			if (status && status !== 'all') {
				query.status = status;
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
				.select('+provider +finance +linkProductProvider')
				.populate('provider')
				.populate({
					path: 'combineWith.product',
					select: 'model brand price images category status slug variants'
				})
				.lean() as unknown as IProduct;
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch products', 'Error al obtener los productos', 500);
		}
	}

	static async getProductById(models: TenantModels, id: string): Promise<IProduct> {
		try {
			const product = (await models.Product.findById(id)
				.select('+provider +finance +linkProductProvider')
				.populate({
					path: 'combineWith.product',
					select: 'model brand price images category status slug variants'
				})
				.lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product', 'Error al obtener el producto', 500);
		}
	}

	static async findByBarcode(
		models: TenantModels,
		rawBarcode: string
	): Promise<{ product: IProduct; matchedVariant: any | null }> {
		try {
			const barcode = rawBarcode.trim();
			if (!barcode) {
				throw new AppError('Barcode is required', 'El código de barras es requerido', 400);
			}

			// Busca por barcode a nivel raíz (KioskProduct) o en cualquier variante / SKU
			const product = (await models.Product.findOne({
				$or: [
					{ barcode: barcode },
					{ 'variants.barcode': barcode },
					{ 'variants.sku': barcode }
				]
			})
				.select('+provider +finance +linkProductProvider')
				.populate('provider')
				.lean()) as unknown as IProduct;

			if (!product) {
				throw new AppError('Product not found for barcode', 'Producto no encontrado para el código de barras', 404);
			}

			// Encontrar la variante específica coincidente si existe
			let matchedVariant: any = null;
			if (Array.isArray(product.variants) && product.variants.length > 0) {
				matchedVariant = product.variants.find(
					(v: any) => v.barcode === barcode || v.sku === barcode
				) || product.variants[0];
			}

			return { product, matchedVariant };
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product by barcode', 'Error al buscar producto por código de barras', 500);
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

				if (product.status !== 'published') {
					throw new AppError(
						`Product ${product.brand} ${product.model} is not published`,
						`El producto ${product.brand} ${product.model} no está disponible para la compra`,
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
			const products = await models.Product.find({ status: 'published' }).select('slug -_id -productType').lean() as unknown as { slug: string }[];
			return products;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product slugs', 'Error al obtener los slugs de los productos', 500);
		}
	}

	static async getPaginatedProducts(models: TenantModels, page: number = 1, limit: number = 20, productType?: string, category?: string) {
		try {
			const Model = this.getModel(models, productType);
			const query: any = { status: 'published' };
			if (category) {
				const catQuery = await this.buildCategoryQuery(models, category);
				query.$or = [
					{ category: catQuery },
					{ clothingType: catQuery }
				];
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
		status?: string,
		providerId?: string,
		hasSizeGuide?: boolean,
		hasSeoImage?: boolean,
		isFeatured?: boolean,
		sortBy?: string
	) {
		try {
			const Model = this.getModel(models, productType);

			const query: any = {};
			const andConditions: any[] = [];

			if (q && typeof q === 'string' && q.trim() !== '') {

				const trimmedQ = q.trim();
				const isUrl = /^https?:\/\//i.test(trimmedQ) || trimmedQ.includes('www.');

				// Si es una URL completa, no la fragmentamos por comas ni delimitadores
				const terms = isUrl ? [trimmedQ] : trimmedQ.split(/[,;|]+/).map(t => t.trim()).filter(Boolean);

				if (terms.length === 1) {
					const escapedTerm = escapeRegex(terms[0]);
					const regex = { $regex: escapedTerm, $options: 'i' };
					const orConditions: any[] = [
						{ brand: regex },
						{ model: regex },
						{ subtitle: regex },
						{ name: regex },
						{ category: regex },
						{ clothingType: regex },
						{ tags: regex },
						{ 'variants.sku': regex },
						{ 'variants.barcode': regex },
						{ barcode: regex },
						{ linkProductProvider: regex }
					];

					// Si parece una URL, también buscamos por la URL base limpia sin query params
					if (isUrl) {
						let cleanUrl = terms[0];
						try {
							const parsed = new URL(terms[0]);
							cleanUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
						} catch {
							cleanUrl = terms[0].split('?')[0].split('#')[0].replace(/\/+$/, '');
						}
						const escapedClean = escapeRegex(cleanUrl);
						if (escapedClean !== escapedTerm) {
							orConditions.push({ linkProductProvider: { $regex: escapedClean, $options: 'i' } });
						}
					}

					andConditions.push({ $or: orConditions });
				} else if (terms.length > 1) {
					const orTerms = terms.map(term => {
						const regex = { $regex: escapeRegex(term), $options: 'i' };
						return {
							$or: [
								{ brand: regex },
								{ model: regex },
								{ subtitle: regex },
								{ name: regex },
								{ category: regex },
								{ clothingType: regex },
								{ tags: regex },
								{ 'variants.sku': regex },
								{ 'variants.barcode': regex },
								{ barcode: regex },
								{ linkProductProvider: regex }
							]
						};
					});
					andConditions.push({ $or: orTerms });
				}
			}

			if (category) {
				const cats = category.split(',').map(c => c.trim()).filter(Boolean);
				if (cats.length === 1) {
					const escaped = cats[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
					query.category = new RegExp(`^${escaped}$`, 'i');
				} else if (cats.length > 1) {
					const regexes = cats.map(c => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
					query.category = { $in: regexes };
				}
			}

			if (status && status !== 'all') {
				query.status = status;
			}

			if (providerId) {
				query.provider = providerId;
			}

			if (hasSizeGuide !== undefined) {
				if (hasSizeGuide) {
					query['sizeGuide.rows.0'] = { $exists: true };
				} else {
					andConditions.push({
						$or: [
							{ sizeGuide: { $exists: false } },
							{ 'sizeGuide.rows': { $size: 0 } },
							{ 'sizeGuide.rows': { $exists: false } }
						]
					});
				}
			}

			if (hasSeoImage !== undefined) {
				if (hasSeoImage) {
					query['seo.metaImage.url'] = { $exists: true, $ne: '' };
				} else {
					andConditions.push({
						$or: [
							{ seo: { $exists: false } },
							{ 'seo.metaImage': { $exists: false } },
							{ 'seo.metaImage.url': { $exists: false } },
							{ 'seo.metaImage.url': '' }
						]
					});
				}
			}

			if (isFeatured !== undefined) {
				query.isFeatured = isFeatured;
			}

			if (andConditions.length > 0) {
				query.$and = andConditions;
			}

			let sort: any = { createdAt: -1 };
			if (sortBy === 'price_asc') {
				sort = { 'price.cashTransferPrice': 1, 'price.listPrice': 1 };
			} else if (sortBy === 'price_desc') {
				sort = { 'price.cashTransferPrice': -1, 'price.listPrice': -1 };
			} else if (sortBy === 'oldest') {
				sort = { createdAt: 1 };
			} else if (sortBy === 'name_asc') {
				sort = { model: 1, brand: 1 };
			} else if (sortBy === 'name_desc') {
				sort = { model: -1, brand: -1 };
			} else if (sortBy === 'featured') {
				sort = { isFeatured: -1, createdAt: -1 };
			} else if (sortBy === 'ranking' || sortBy === 'ranking_desc') {
				sort = { effectiveScore: -1, isFeatured: -1, createdAt: -1 };
			} else if (sortBy === 'ranking_asc') {
				sort = { effectiveScore: 1, createdAt: -1 };
			}

			const [result, statusCountsRaw] = await Promise.all([
				paginate(Model, query, {
					page,
					limit,
					sort,
					select: '+provider +finance +linkProductProvider',
					populate: [
						{ path: 'provider' },
						{ path: 'combineWith.product', select: 'model brand category slug images price variants' }
					]
				}),
				Model.aggregate([
					{
						$group: {
							_id: '$status',
							count: { $sum: 1 }
						}
					}
				])
			]);

			const statusCounts = {
				all: 0,
				published: 0,
				draft: 0,
				paused: 0,
				archived: 0
			};

			for (const sc of statusCountsRaw) {
				const key = sc._id as 'published' | 'draft' | 'paused' | 'archived';
				if (key && statusCounts[key] !== undefined) {
					statusCounts[key] = sc.count;
				}
				statusCounts.all += sc.count;
			}

			return {
				...result,
				statusCounts
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch paginated products', 'Error al obtener los productos', 500);
		}
	}

	static async getQualityAudit(models: TenantModels) {
		try {
			const products = (await models.Product.find({ status: 'published' })
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
					slug: p.slug,
					sizeGuide: {
						headers: p.sizeGuide?.headers || [],
						rowCount: p.sizeGuide?.rows?.length || 0,
						sizes: (p.sizeGuide?.rows || []).map((r: any) => r.size)
					}
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
			const product = (await models.Product.findOne({ slug, status: 'published' })
				.populate({
					path: 'combineWith.product',
					select: 'model brand price salePrice images category status slug fit variants',
					match: { status: 'published' }
				})
				.lean()) as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to fetch product by slug', 'Error al obtener el producto', 500);
		}
	}

	// ============ SEARCH & RECOMMENDATIONS DELEGATIONS ============
	static getRecommendationsForProduct = ProductSearchService.getRecommendationsForProduct;
	static getSearchSuggestions = ProductSearchService.getSearchSuggestions;
	static getProductMetadata = ProductSearchService.getProductMetadata;
	static searchProducts = ProductSearchService.searchProducts;

	// ============ RANKING & METRICS DELEGATIONS ============
	static recordProductView = ProductRankingService.recordProductView;
	static getProductViewsAudit = ProductRankingService.getProductViewsAudit;
	static approveManualViewPoint = ProductRankingService.approveManualViewPoint;
	static recordCartAdd = ProductRankingService.recordCartAdd;
	static recordProductSale = ProductRankingService.recordProductSale;
	static updateRankingScore = ProductRankingService.updateRankingScore;
	static recalculateAllEffectiveScores = ProductRankingService.recalculateAllEffectiveScores;

	static resetAllToRankingBase = ProductRankingService.resetAllToRankingBase;
	static resetProductRankingBase = ProductRankingService.resetProductRankingBase;

	static getSmartNews = ProductRankingService.getSmartNews;


	static async createProduct(models: TenantModels, data: IProductCreateDTO, imagesDTO: Express.Multer.File[], ogImageFile: Express.Multer.File | null, tenantSlug: string = 'general'): Promise<IProduct> {
		try {
			if (!data.productType) {
				throw new AppError('Product type is required', 'El tipo de producto (productType) es obligatorio', 400);
			}
			if (!data.brand || typeof data.brand !== 'string' || !data.brand.trim()) {
				throw new AppError('Brand is required', 'La marca del producto es obligatoria', 400);
			}
			const slug = this.generateSlug(data.brand, data.model);
			const config = await EcommerceService.getConfig(models);
			const businessType = config.businessType;
			if (!businessType) {
				throw new AppError('Business type not configured', 'El comercio no tiene un rubro comercial configurado en su tienda', 500);
			}
			if (!isProductTypeAllowed(businessType, data.productType)) {
				throw new AppError('Product type not allowed', `El tipo de producto '${data.productType}' no está permitido para el rubro comercial '${businessType}'. Tipos permitidos: ${getAllowedProductTypes(businessType).join(', ')}`, 400);
			}

			const { venta } = await getDolar(config.dollarQuoteType || 'oficial', config.customDollarRate || 0);

			const parsedAdditionalCosts = typeof data.additionalCosts === 'string'
				? JSON.parse(data.additionalCosts)
				: data.additionalCosts;

			const additionalCosts = (Array.isArray(parsedAdditionalCosts) && parsedAdditionalCosts.length > 0)
				? parsedAdditionalCosts
				: (config.defaultAdditionalCosts || []);

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

			let images: any[] = [];
			if (imagesDTO && imagesDTO.length > 0) {
				const rawImages = imagesDTO.map((image) => ({
					id: `${data.brand}-${data.model}`,
					source: image
				}));
				images = await ImageService.UploadImages(rawImages, `${tenantSlug}/product-images`);
			} else if (Array.isArray(data.images) && data.images.length > 0) {
				images = data.images;
			} else if (data.productType !== ProductType.KIOSK) {
				throw new AppError('No images provided', 'No se proporcionaron imágenes', 400);
			}

			// Para productos de tipo KIOSK: inicializar variante por defecto si no vino ninguna
			if (data.productType === ProductType.KIOSK) {
				const variantsArr = Array.isArray(data.variants) ? data.variants : [];
				if (variantsArr.length === 0) {
					data.variants = [{
						sku: '',
						stock: (data as any).stock !== undefined ? Number((data as any).stock) : 0,
						reservedStock: 0,
						barcode: data.barcode ? data.barcode.trim() : undefined,
						isActive: true
					}] as any[];
				} else if (variantsArr.length === 1 && data.barcode && !(variantsArr[0] as any).barcode) {
					(variantsArr[0] as any).barcode = data.barcode.trim();
				}
			}

			if (data.variants && data.variants.length > 0 && Array.isArray(data.variants)) {
				data.variants = data.variants.map((v: any) => {
					if (v.imageIndex !== undefined && v.imageIndex !== null && images[v.imageIndex]) {
						v.imageReference = {
							url: images[v.imageIndex].url,
							public_id: images[v.imageIndex].public_id
						};
					}
					delete v.imageIndex; // Lo borramos para que Mongoose no chille
					if (!v.sku || typeof v.sku !== 'string' || v.sku.trim() === '') {
						delete v.sku; // Si no tiene SKU, SkuService lo auto-genera
					} else {
						v.sku = v.sku.trim();
					}
					return v;
				});

				// ── Auto-generar SKUs para las variantes que no tengan ──
				data.variants = await SkuService.generateSkusForVariants(
					models,
					data.variants as any[],
					data.category,
					data.productType,
					data.brand
				);

				// ── Validar que ningún SKU colisione internamente ni con otro producto ──
				await this.validateUniqueSkus(models, data.variants as any[]);
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

			const baseScore = data.rankingScore !== undefined && data.rankingScore !== null && !isNaN(Number(data.rankingScore))
				? Number(data.rankingScore)
				: 100;

			// Campos comunes
			const baseData: any = {
				slug,
				linkProductProvider: data.linkProductProvider || '',
				brand: data.brand,
				shortDescription: data.shortDescription ? this.sanitizeDescription(data.shortDescription) : `${data.brand} ${data.model}`,
				largeDescription: data.largeDescription ? this.sanitizeDescription(data.largeDescription) : '',
				model: data.model,
				category: data.category,
				features: data.features || [],

				price,
				finance,
				images,
				specifications: data.specifications || [],
				variants: data.variants || [],
				status: data.status || 'draft',
				isFeatured: Boolean(data.isFeatured),
				rankingScore: baseScore,
				effectiveScore: baseScore,
				tags: data.tags || [],
				seo: seoData
			};

			if (data.provider && data.provider !== '') {
				baseData.provider = data.provider;
			}

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
				if (data.combineWith) {
					const raw = Array.isArray(data.combineWith)
						? data.combineWith
						: (typeof data.combineWith === 'string' ? JSON.parse(data.combineWith) : []);
					baseData.combineWith = (Array.isArray(raw) ? raw : []).map((item: any) => {
						if (typeof item === 'string') return { product: item, color: null };
						if (item && typeof item === 'object') {
							const prodId = item.product || item._id;
							return prodId ? { product: typeof prodId === 'object' ? prodId._id : prodId, color: item.color || null } : null;
						}
						return null;
					}).filter(Boolean);
				}
			}

			// Campos específicos de belleza / perfumería
			if (data.productType === ProductType.BEAUTY) {
				if (data.volume) baseData.volume = data.volume;
				if (data.concentration) baseData.concentration = data.concentration;
				if (data.fragranceFamily) baseData.fragranceFamily = data.fragranceFamily;
				if (data.gender) baseData.gender = data.gender;
				if (data.scentNotes) baseData.scentNotes = typeof data.scentNotes === 'string' ? JSON.parse(data.scentNotes) : data.scentNotes;
				if (data.applicationArea) baseData.applicationArea = data.applicationArea;
			}

			// Campos específicos de mostrador (Kiosco / Almacén / Carnicería / Panadería)
			if (data.productType === ProductType.KIOSK) {
				if (data.barcode) baseData.barcode = data.barcode.trim();
				if (data.isSoldByWeight !== undefined) baseData.isSoldByWeight = Boolean(data.isSoldByWeight);
				if (data.unit) baseData.unit = data.unit;
				if (data.weight) baseData.weight = data.weight;
			}

			const newProduct = await Model.create(baseData);
			if (baseData.provider) {
				await newProduct.populate('provider');
			}

			// Crowdsourcing silencioso al catálogo global de Vexx
			const barcodeToSync = baseData.barcode || baseData.variants?.[0]?.barcode;
			if (barcodeToSync) {
				try {
					const { MasterCatalogService } = await import('./masterCatalog.service');
					MasterCatalogService.silentlyUpsertFromProduct({
						barcode: barcodeToSync,
						model: baseData.model,
						brand: baseData.brand,
						category: baseData.category,
						imageUrl: baseData.images?.[0]?.url || '',
						unit: baseData.unit || 'un',
						isSoldByWeight: baseData.isSoldByWeight,
						price: baseData.price?.card_ticket1PayPrice || baseData.price?.listPrice || 0
					});
				} catch {
					// Ignorar errores en background sync
				}
			}

			return newProduct.toObject() as unknown as IProduct;
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to create product', 'Error al crear el producto', 500);
		}
	}

	// ============ UPDATE ============

	// ============ PRICING DELEGATIONS ============
	static previewRecalculatePrices = ProductPricingService.previewRecalculatePrices;
	static recalculateAllProductsPrices = ProductPricingService.recalculateAllProductsPrices;

	static async updateProductById(models: TenantModels, id: string, updateData: Partial<IProductUpdateDTO>, files: Express.Multer.File[], ogImageFile: Express.Multer.File | null, tenantSlug: string = 'general'): Promise<IProduct> {
		console.log('updateProductById');
		console.log('Data:');
		console.log(updateData);
		try {
			let imagesToDelete: string[] = [];
			if (updateData.deletedImages) {
				try {
					const parsed = typeof updateData.deletedImages === 'string'
						? JSON.parse(updateData.deletedImages)
						: updateData.deletedImages;
					if (Array.isArray(parsed)) {
						imagesToDelete = parsed.filter((pubId): pubId is string => typeof pubId === 'string' && pubId.trim().length > 0);
					}
				} catch (err) {
					console.error('Error parsing deletedImages in updateProductById:', err);
				}
			}

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
			let parsedImagesOrder: string[] | null = null;
			if (imagesOrderStr) {
				try {
					const parsed = typeof imagesOrderStr === 'string' ? JSON.parse(imagesOrderStr) : imagesOrderStr;
					if (Array.isArray(parsed)) {
						parsedImagesOrder = parsed;
					}
				} catch (error) {
					console.error('Error parsing imagesOrder', error);
				}
			}

			// If imagesOrder was sent, prune any existing images that were removed by the user in the UI
			if (parsedImagesOrder) {
				const imagesToDrop = currentImages.filter(img => {
					const url = img.url;
					const secUrl = (img as any).secure_url;
					return !parsedImagesOrder!.includes(url) && (!secUrl || !parsedImagesOrder!.includes(secUrl));
				});
				for (const dropped of imagesToDrop) {
					if (dropped.public_id && !imagesToDelete.includes(dropped.public_id)) {
						await ImageService.DeleteImage(dropped.public_id);
					}
				}
				currentImages = currentImages.filter(img => {
					const url = img.url;
					const secUrl = (img as any).secure_url;
					return parsedImagesOrder!.includes(url) || (secUrl && parsedImagesOrder!.includes(secUrl));
				});
			}

			if (files && files.length > 0) {
				const brand = updateData.brand || product.brand;
				const model = updateData.model || product.model;

				const rawImages = files.map((file) => ({
					id: `${brand}-${model}`,
					source: file
				}));

				const newImages = await ImageService.UploadImages(rawImages, `${tenantSlug}/product-images`);

				if (parsedImagesOrder && parsedImagesOrder.length > 0) {
					let newImgIdx = 0;
					const finalOrderMap = parsedImagesOrder.map(link => {
						if (typeof link === 'string' && link.startsWith('blob:') && newImgIdx < newImages.length) {
							const uploadedImg = newImages[newImgIdx++];
							return uploadedImg.url;
						}
						return link;
					});

					const combined = [...currentImages, ...newImages];
					combined.sort((a: any, b: any) => {
						const urlA = a.url || a.secure_url;
						const urlB = b.url || b.secure_url;
						const idxA = finalOrderMap.indexOf(urlA);
						const idxB = finalOrderMap.indexOf(urlB);

						if (idxA === -1 && idxB === -1) return 0;
						if (idxA === -1) return 1;
						if (idxB === -1) return -1;

						return idxA - idxB;
					});
					updateData.images = combined;
				} else {
					updateData.images = [...currentImages, ...newImages];
				}
			} else if (imagesToDelete.length > 0 || parsedImagesOrder) {
				if (parsedImagesOrder && parsedImagesOrder.length > 0) {
					currentImages.sort((a: any, b: any) => {
						const urlA = a.url || a.secure_url;
						const urlB = b.url || b.secure_url;
						const idxA = parsedImagesOrder!.indexOf(urlA);
						const idxB = parsedImagesOrder!.indexOf(urlB);

						if (idxA === -1 && idxB === -1) return 0;
						if (idxA === -1) return 1;
						if (idxB === -1) return -1;

						return idxA - idxB;
					});
				}
				updateData.images = currentImages;
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
				const config = await EcommerceService.getConfig(models);

				const { venta } = await getDolar(config.dollarQuoteType || 'oficial', config.customDollarRate || 0);
				const currentCustomProfitMargin = updateData.customProfitMargin !== undefined ? updateData.customProfitMargin : product.finance?.pricingStrategy?.targetProfit;

				// Attempt to get the current base price. If updateData.providerCost or updateData.price is provided, use it.
				// Otherwise try temporary product.price. As a final fallback, safely cast the stored base price cost
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
			if (updateData.linkProductProvider !== undefined) updateData.linkProductProvider = updateData.linkProductProvider;
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
						if (!v.sku || typeof v.sku !== 'string' || v.sku.trim() === '') {
							v.sku = match.sku;
						} else {
							v.sku = v.sku.trim();
						}
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

				// ── Validar que ningún SKU colisione internamente ni con otro producto ──
				await this.validateUniqueSkus(models, updateData.variants as any[], id);
			}
			if (updateData.tags) updateData.tags = JSON.parse(updateData.tags as string);
			if (updateData.careInstructions) updateData.careInstructions = JSON.parse(updateData.careInstructions as string);
			if (updateData.composition) updateData.composition = JSON.parse(updateData.composition as string);
			if (updateData.sizeGuide) updateData.sizeGuide = typeof updateData.sizeGuide === 'string' ? JSON.parse(updateData.sizeGuide) : updateData.sizeGuide;
			if (updateData.season) updateData.season = updateData.season as string;
			if ((updateData as any).combineWith !== undefined) {
				try {
					const raw = typeof (updateData as any).combineWith === 'string'
						? JSON.parse((updateData as any).combineWith)
						: (updateData as any).combineWith;
					(updateData as any).combineWith = Array.isArray(raw)
						? raw.map((item: any) => {
							if (typeof item === 'string') return { product: item, color: null };
							if (item && typeof item === 'object') {
								const prodId = item.product || item._id;
								return prodId ? { product: typeof prodId === 'object' ? prodId._id : prodId, color: item.color || null } : null;
							}
							return null;
						}).filter(Boolean)
						: [];
				} catch (err) {
					console.error('Error parsing combineWith in updateProductById:', err);
					(updateData as any).combineWith = [];
				}
			}
			// Parsear SEO si viene como JSON string
			if (updateData.seo) updateData.seo = JSON.parse(updateData.seo as unknown as string);

			// Actualizar rankingScore base y recalcular effectiveScore
			if (updateData.rankingScore !== undefined && updateData.rankingScore !== null) {
				const newBaseScore = Number(updateData.rankingScore);
				if (!isNaN(newBaseScore)) {
					updateData.rankingScore = newBaseScore;
					const config = await EcommerceService.getConfig(models);

					const viewWeight = config.catalogRanking?.viewWeight ?? 1;
					const cartWeight = config.catalogRanking?.cartWeight ?? 5;
					const saleWeight = config.catalogRanking?.saleWeight ?? 25;

					const views = product.metrics?.viewsCount || 0;
					const carts = product.metrics?.cartAddsCount || 0;
					const sales = product.metrics?.salesCount || 0;

					(updateData as any).effectiveScore = newBaseScore + (views * viewWeight) + (carts * cartWeight) + (sales * saleWeight);
				}
			}

			if (updateData.isFeatured !== undefined) {
				updateData.isFeatured = String(updateData.isFeatured) === 'true' || updateData.isFeatured === true;
			}

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
			const TargetModel = this.getModel(models, product.productType);

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

	// ============ INVENTORY DELEGATIONS ============
	static verifyVariantStock = ProductInventoryService.verifyVariantStock;
	static reduceVariantStock = ProductInventoryService.reduceVariantStock;
	static restoreVariantStock = ProductInventoryService.restoreVariantStock;

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

	static async bulkUpdateStatus(models: TenantModels, ids: string[], status: ProductStatus): Promise<boolean> {
		try {
			await models.Product.updateMany(
				{ _id: { $in: ids.map(id => new Types.ObjectId(id)) } },
				{ $set: { status } }
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

	static async updateProductStatus(models: TenantModels, id: string, status: ProductStatus): Promise<IProduct> {
		try {
			const product = await models.Product.findByIdAndUpdate(
				id,
				{ $set: { status } },
				{ new: true }
			).lean() as unknown as IProduct;
			if (!product) throw new AppError('Product not found', 'Producto no encontrado', 404);
			return product;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to update product status',
				'Error al actualizar el estado del producto',
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

	/**
	 * Valida que ningún SKU del array de variantes exista ya en otro producto ni esté repetido internamente.
	 * Si encuentra duplicado, lanza un AppError descriptivo con el SKU y el nombre del producto en conflicto.
	 */
	static async validateUniqueSkus(
		models: TenantModels,
		variants: any[],
		excludeProductId?: string | Types.ObjectId
	): Promise<void> {
		if (!variants || !Array.isArray(variants) || variants.length === 0) return;

		const skusToCheck = variants
			.map(v => (v.sku && typeof v.sku === 'string' ? v.sku.trim() : ''))
			.filter(Boolean);

		if (skusToCheck.length === 0) return;

		// 1. Verificar duplicados dentro del mismo payload enviado
		const seenInPayload = new Set<string>();
		for (const sku of skusToCheck) {
			const normalized = sku.toUpperCase();
			if (seenInPayload.has(normalized)) {
				throw new AppError(
					`Duplicate SKU in payload: ${sku}`,
					`El SKU '${sku}' está repetido en más de una variante de este producto. Cada variante debe tener un SKU único.`,
					400
				);
			}
			seenInPayload.add(normalized);
		}

		// 2. Verificar contra la base de datos (otros productos)
		const query: any = {
			'variants.sku': { $in: skusToCheck }
		};

		if (excludeProductId) {
			query._id = { $ne: excludeProductId };
		}

		const conflictingProduct = (await models.Product.findOne(query)
			.select('_id model brand variants.sku')
			.lean()) as unknown as any;

		if (conflictingProduct) {
			// Encontrar cuál es el SKU exacto que colisionó
			const conflictingSku = skusToCheck.find(sku =>
				conflictingProduct.variants?.some((v: any) => v.sku?.toUpperCase() === sku.toUpperCase())
			) || skusToCheck[0];

			const prodName = conflictingProduct.model || conflictingProduct.brand || 'otro producto';

			throw new AppError(
				`SKU conflict: ${conflictingSku} already in use by product ${conflictingProduct._id}`,
				`El SKU '${conflictingSku}' ya está en uso en el producto '${prodName}'. Por favor elegí un SKU diferente.`,
				400
			);
		}
	}

	static async getPublicActiveProducts(models: TenantModels) {
		try {
			const products = await models.Product.find({ status: 'published' })
				.populate('provider')
				.lean();
			return products;
		} catch (error) {
			throw new AppError('Failed to fetch active products', 'Error al obtener los productos activos', 500);
		}
	}

	/**
	 * Creación masiva de productos (Asistente IA & Excel).
	 * Recalcula finanzas, genera SKUs, sanitiza descripciones y persiste en lote.
	 */
	static async bulkCreateProducts(
		models: TenantModels,
		productsData: any[],
		tenantSlug: string = 'general'
	): Promise<{ success: boolean; createdCount: number; created: IProduct[]; errors: any[] }> {
		const created: IProduct[] = [];
		const errors: any[] = [];

		const config = await EcommerceService.getConfig(models);
		const { venta } = await getDolar(config.dollarQuoteType || 'oficial', config.customDollarRate || 0);

		for (let i = 0; i < productsData.length; i++) {
			const item = productsData[i];
			try {
				if (!item.model || !item.brand || !item.category) {
					throw new AppError('Missing required fields (model, brand, category)', 'Faltan campos obligatorios (modelo, marca, categoría)', 400);
				}

				if (!item.productType) {
					throw new AppError('Missing productType', 'El tipo de producto (productType) es obligatorio', 400);
				}

				const productType = item.productType;
				const businessType = config.businessType;
				if (!businessType) {
					throw new AppError('Business type not configured', 'El comercio no tiene un rubro comercial configurado en su tienda', 500);
				}
				if (!isProductTypeAllowed(businessType, productType)) {
					throw new AppError('Product type not allowed', `El tipo de producto '${productType}' no está permitido para el rubro comercial '${businessType}'. Tipos permitidos: ${getAllowedProductTypes(businessType).join(', ')}`, 400);
				}
				const costPriceARS = Number(item.costPriceARS || item.price || item.providerCost || 0);

				const rawAdditionalCosts = item.additionalCosts;
				const additionalCosts = (Array.isArray(rawAdditionalCosts) && rawAdditionalCosts.length > 0)
					? rawAdditionalCosts
					: (config.defaultAdditionalCosts || []);

				const { price, finance } = await FinanceService.CalculatePrices({
					providerCost: costPriceARS,
					additionalCosts: additionalCosts,
					discountPercentageTransfer: item.discountPercentageTransfer ? Number(item.discountPercentageTransfer) : undefined,
					dolar: venta,
					models,
					useCustomProfit: item.useCustomProfit ?? (item.customProfitMargin !== undefined && item.customProfitMargin !== null),
					customProfitMargin: item.customProfitMargin ? Number(item.customProfitMargin) : undefined,
					pricingMethodChoice: item.pricingMethodChoice
				});

				// Provider resolution (by ObjectId or name)
				let providerId: any = undefined;
				if (item.provider) {
					const provStr = String(item.provider).trim();
					if (Types.ObjectId.isValid(provStr)) {
						providerId = provStr;
					} else {
						const foundProv = await models.Provider.findOne({
							name: new RegExp('^' + provStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
						});
						if (foundProv) {
							providerId = foundProv._id;
						}
					}
				}
				if (!providerId) {
					const defaultProv = await models.Provider.findOne({ active: true });
					if (defaultProv) {
						providerId = defaultProv._id;
					}
				}

				const brand = String(item.brand).trim();
				const slug = this.generateSlug(brand, item.model);

				// Process images
				let images: any[] = [];
				if (Array.isArray(item.images) && item.images.length > 0) {
					images = item.images.map((img: any) => {
						if (typeof img === 'string') return { url: String(img).trim(), public_id: '' };
						return { url: img.url || '', public_id: img.public_id || '' };
					}).filter((img: any) => img.url);
				}

				// Process variants
				let variants = Array.isArray(item.variants) ? item.variants : [];
				variants = variants.map((v: any) => {
					const cName = v.colorName || (typeof v.color === 'string' ? v.color : v.color?.name) || 'Único';
					const cHex = v.colorHex || v.color?.hex || '#000000';
					const imgIdx = v.imageIndex !== undefined && v.imageIndex !== null ? Number(v.imageIndex) : undefined;
					const variantObj: any = {
						colorName: cName,
						colorHex: cHex,
						color: { name: cName, hex: cHex },
						size: String(v.size || v.talle || 'Único').trim().toUpperCase(),
						stock: Number(v.stock ?? 0) >= 0 ? Number(v.stock ?? 0) : 0,
						isActive: v.isActive !== false,
						sku: v.sku ? String(v.sku).trim() : undefined,
						imageIndex: imgIdx !== undefined && !isNaN(imgIdx) ? imgIdx : 0
					};
					if (imgIdx !== undefined && !isNaN(imgIdx) && images[imgIdx]) {
						variantObj.imageReference = {
							url: images[imgIdx].url,
							public_id: images[imgIdx].public_id
						};
					}
					return variantObj;
				});

				if (variants.length > 0) {
					variants = await SkuService.generateSkusForVariants(
						models,
						variants,
						item.category,
						productType,
						brand
					);
				}

				// Sanitize largeDescription HTML
				let largeDescription = item.largeDescription || item.description || item.shortDescription || '';
				if (largeDescription) {
					const window = new JSDOM('').window;
					const purify = createDOMPurify(window);
					largeDescription = purify.sanitize(largeDescription, this.purifyConfig);
				}

				// Process composition if provided
				let composition = undefined;
				if (Array.isArray(item.composition) && item.composition.length > 0) {
					composition = item.composition.map((c: any) => ({
						material: String(c.material || '').trim(),
						percentage: Number(c.percentage || 0)
					})).filter((c: any) => c.material && !isNaN(c.percentage));
				}

				// Process careInstructions if provided
				let careInstructions = undefined;
				if (Array.isArray(item.careInstructions) && item.careInstructions.length > 0) {
					careInstructions = item.careInstructions.map((ci: any) => String(ci).trim()).filter(Boolean);
				}

				// Process specifications / attributes (ficha técnica)
				let specifications: any[] = [];
				if (Array.isArray(item.specifications)) {
					specifications = item.specifications.map((s: any) => ({
						key: String(s.key || s.nombre || s.name || '').trim(),
						value: String(s.value || s.valor || '').trim()
					})).filter((s: any) => s.key && s.value);
				} else if (typeof item.specifications === 'object' && item.specifications !== null) {
					specifications = Object.entries(item.specifications).map(([key, value]) => ({
						key: String(key).trim(),
						value: String(value).trim()
					})).filter((s: any) => s.key && s.value);
				} else if (typeof item.specifications === 'string' && item.specifications.trim()) {
					specifications = item.specifications.split(/[,;\n]+/).map((part: string) => {
						const [k, ...v] = part.split(/[:=]/);
						return { key: (k || '').trim(), value: (v.join(':') || '').trim() };
					}).filter((s: any) => s.key && s.value);
				}

				// Process tags
				let tags: string[] = [];
				if (Array.isArray(item.tags)) {
					tags = item.tags.map((t: any) => String(t).trim()).filter(Boolean);
				} else if (typeof item.tags === 'string' && item.tags.trim()) {
					tags = item.tags.split(/[,;\n]+/).map((t: string) => t.trim()).filter(Boolean);
				}

				// Process SEO
				const metaTitle = item.seo?.metaTitle || item.metaTitle || `${item.model} | ${brand}`;
				const metaDescription = item.seo?.metaDescription || item.metaDescription || item.shortDescription || '';
				const metaImage = item.seo?.metaImage || (images.length > 0 ? { url: images[0].url, public_id: images[0].public_id || '' } : undefined);
				const seo = {
					metaTitle: String(metaTitle).trim(),
					metaDescription: String(metaDescription).trim(),
					...(metaImage ? { metaImage } : {})
				};

				// Process sizeGuide (optional)
				let sizeGuide = undefined;
				if (item.sizeGuide && typeof item.sizeGuide === 'object') {
					if (Array.isArray(item.sizeGuide.headers) && Array.isArray(item.sizeGuide.rows) && item.sizeGuide.rows.length > 0) {
						sizeGuide = {
							headers: item.sizeGuide.headers.map((h: any) => String(h).trim()),
							rows: item.sizeGuide.rows.map((r: any) => ({
								size: String(r.size || '').trim(),
								values: Array.isArray(r.values) ? r.values.map((v: any) => String(v).trim()) : []
							})),
							tolerance: item.sizeGuide.tolerance ? String(item.sizeGuide.tolerance).trim() : undefined
						};
					}
				}

				const productDoc = new models.Product({
					productType,
					brand,
					model: String(item.model).trim(),
					subtitle: item.subtitle ? String(item.subtitle).trim() : undefined,
					category: String(item.category).trim(),
					provider: providerId || undefined,
					linkProductProvider: item.linkProductProvider ? String(item.linkProductProvider).trim() : undefined,
					slug,
					shortDescription: item.shortDescription || '',
					largeDescription,
					price,
					finance,
					variants,
					images,
					sizeGuide,
					gender: item.gender || ClothingGender.Unisex,
					fit: item.fit ? String(item.fit).trim() : undefined,
					material: item.material ? String(item.material).trim() : '',
					season: item.season ? String(item.season).trim() : undefined,
					sizeType: item.sizeType || ClothingSizeType.Ropa,
					composition: composition || undefined,
					careInstructions: careInstructions || undefined,
					features: Array.isArray(item.features) ? item.features : [],
					specifications,
					tags,
					status: item.status || 'draft', // Por defecto Borrador para IA
					isFeatured: Boolean(item.isFeatured),
					seo
				});

				const saved = await productDoc.save();
				created.push(saved.toObject() as unknown as IProduct);
			} catch (err: any) {
				errors.push({ index: i, model: item.model || `Ítem #${i + 1}`, error: err.message || 'Error al crear producto' });
			}
		}

		return { success: errors.length === 0, createdCount: created.length, created, errors };
	}

	/**
	 * Actualización masiva de productos (Asistente IA).
	 * Parchea campos selectivos (variantes/talles, costos, descripciones, SEO) con validación estricta.
	 */
	static async bulkUpdateProducts(
		models: TenantModels,
		updates: any[],
		tenantSlug: string = 'general'
	): Promise<{ success: boolean; updatedCount: number; updated: IProduct[]; errors: any[] }> {
		const updated: IProduct[] = [];
		const errors: any[] = [];

		const config = await EcommerceService.getConfig(models);
		const { venta } = await getDolar(config.dollarQuoteType || 'oficial', config.customDollarRate || 0);

		for (let i = 0; i < updates.length; i++) {
			const item = updates[i];
			try {
				if (!item._id || !Types.ObjectId.isValid(item._id)) {
					throw new AppError('Invalid or missing _id', 'ID de producto inválido', 400);
				}

				const product = await models.Product.findById(item._id).select('+finance');
				if (!product) {
					throw new AppError('Product not found', `Producto no encontrado (ID: ${item._id})`, 404);
				}

				// If price or cost updated, recalculate finances
				if (item.costPriceARS !== undefined || item.price !== undefined || item.providerCost !== undefined) {
					const newCost = Number(item.costPriceARS ?? item.providerCost ?? item.price);
					const { price, finance } = await FinanceService.CalculatePrices({
						providerCost: newCost,
						additionalCosts: item.additionalCosts || product.finance?.additionalCosts || [],
						discountPercentageTransfer: item.discountPercentageTransfer !== undefined ? Number(item.discountPercentageTransfer) : (product.price as any)?.discountPercentageTransfer,
						dolar: venta,
						models,
						useCustomProfit: item.useCustomProfit ?? product.finance?.pricingStrategy?.targetProfit !== undefined,
						customProfitMargin: item.customProfitMargin !== undefined ? Number(item.customProfitMargin) : product.finance?.pricingStrategy?.targetProfit,
						pricingMethodChoice: item.pricingMethodChoice ?? product.finance?.pricingStrategy?.method
					});
					product.price = price;
					product.finance = finance;
				}

				// If variants updated
				if (Array.isArray(item.variants)) {
					let newVariants = item.variants.map((v: any) => ({
						_id: v._id && Types.ObjectId.isValid(v._id) ? v._id : new Types.ObjectId(),
						colorName: v.colorName || v.color || 'Único',
						colorHex: v.colorHex || '#000000',
						size: (() => {
							const raw = String(v.size || v.talle || 'Único').trim();
							return raw.toLowerCase() === 'único' || raw.toLowerCase() === 'unico' ? 'Único' : raw.toUpperCase();
						})(),
						stock: Number(v.stock ?? 0) >= 0 ? Number(v.stock ?? 0) : 0,
						isActive: v.isActive !== false,
						sku: v.sku ? String(v.sku).trim() : undefined,
						imageIndex: v.imageIndex ?? 0
					}));

					newVariants = await SkuService.generateSkusForVariants(
						models,
						newVariants,
						product.category,
						product.productType,
						product.brand
					);

					product.variants = newVariants as any;
				}

				const pAny = product as any;

				// Basic & General Product fields
				if (item.model !== undefined) {
					pAny.model = String(item.model).trim();
				}
				if (item.brand !== undefined) {
					pAny.brand = String(item.brand).trim();
				}
				if (item.model !== undefined || item.brand !== undefined) {
					pAny.slug = this.generateSlug(pAny.brand, pAny.model);
				}
				if (item.subtitle !== undefined) {
					pAny.subtitle = item.subtitle ? String(item.subtitle).trim() : '';
				}
				if (item.category !== undefined) {
					pAny.category = String(item.category).trim();
				}
				if (item.shortDescription !== undefined) {
					pAny.shortDescription = String(item.shortDescription).trim();
				}
				if (item.largeDescription !== undefined) {
					const window = new JSDOM('').window;
					const purify = createDOMPurify(window);
					pAny.largeDescription = purify.sanitize(item.largeDescription, this.purifyConfig);
				}
				if (item.status !== undefined) {
					pAny.status = item.status;
				}
				if (item.isFeatured !== undefined) {
					pAny.isFeatured = Boolean(item.isFeatured);
				}
				if (item.linkProductProvider !== undefined) {
					pAny.linkProductProvider = String(item.linkProductProvider).trim();
				}

				// Specifications / Ficha Técnica (Array de { key, value } o Record<string, string>)
				if (item.specifications !== undefined) {
					let specs: { key: string; value: string }[] = [];
					if (Array.isArray(item.specifications)) {
						specs = item.specifications.map((s: any) => ({
							key: String(s.key || s.nombre || s.name || '').trim(),
							value: String(s.value || s.valor || '').trim()
						})).filter((s: any) => s.key && s.value);
					} else if (typeof item.specifications === 'object' && item.specifications !== null) {
						specs = Object.entries(item.specifications).map(([k, v]) => ({
							key: String(k).trim(),
							value: String(v).trim()
						})).filter((s: any) => s.key && s.value);
					} else if (typeof item.specifications === 'string' && item.specifications.trim()) {
						specs = item.specifications.split(/[,;\n]+/).map((part: string) => {
							const [k, ...v] = part.split(/[:=]/);
							return { key: (k || '').trim(), value: (v.join(':') || '').trim() };
						}).filter((s: any) => s.key && s.value);
					}
					pAny.specifications = specs;
				}

				// Features (viñetas destacadas)
				if (item.features !== undefined) {
					if (Array.isArray(item.features)) {
						pAny.features = item.features.map((f: any) => String(f).trim()).filter(Boolean);
					} else if (typeof item.features === 'string' && item.features.trim()) {
						pAny.features = item.features.split(/[,;\n]+/).map((f: string) => f.trim()).filter(Boolean);
					}
				}

				// Tags (etiquetas de búsqueda)
				if (item.tags !== undefined) {
					if (Array.isArray(item.tags)) {
						pAny.tags = item.tags.map((t: any) => String(t).trim()).filter(Boolean);
					} else if (typeof item.tags === 'string' && item.tags.trim()) {
						pAny.tags = item.tags.split(/[,;\n]+/).map((t: string) => t.trim()).filter(Boolean);
					}
				}

				// SEO (Meta Título y Meta Descripción)
				if (item.seo !== undefined && typeof item.seo === 'object') {
					pAny.seo = {
						...(pAny.seo || {}),
						...(item.seo.metaTitle !== undefined ? { metaTitle: String(item.seo.metaTitle).trim() } : {}),
						...(item.seo.metaDescription !== undefined ? { metaDescription: String(item.seo.metaDescription).trim() } : {}),
						...(item.seo.metaImage ? { metaImage: item.seo.metaImage } : {})
					};
				}
				if (item.seoTitle !== undefined || item.seoMetaTitle !== undefined || item.metaTitle !== undefined) {
					const titleVal = item.seoTitle ?? item.seoMetaTitle ?? item.metaTitle;
					pAny.seo = { ...(pAny.seo || {}), metaTitle: String(titleVal).trim() };
				}
				if (item.seoDescription !== undefined || item.seoMetaDescription !== undefined || item.metaDescription !== undefined) {
					const descVal = item.seoDescription ?? item.seoMetaDescription ?? item.metaDescription;
					pAny.seo = { ...(pAny.seo || {}), metaDescription: String(descVal).trim() };
				}

				// ClothingProduct Fields
				if (item.gender !== undefined) pAny.gender = item.gender;
				if (item.fit !== undefined) pAny.fit = String(item.fit).trim();
				if (item.material !== undefined) pAny.material = String(item.material).trim();
				if (item.sizeType !== undefined) pAny.sizeType = item.sizeType;
				if (item.season !== undefined) pAny.season = String(item.season).trim();

				// Composition (Array de { material: string, percentage: number } o parsing de texto ej: "95% Algodón, 5% Elastano")
				if (item.composition !== undefined) {
					let composition: { material: string; percentage: number }[] = [];
					if (Array.isArray(item.composition)) {
						composition = item.composition.map((c: any) => ({
							material: String(c.material || '').trim(),
							percentage: Number(c.percentage || 0)
						})).filter((c: any) => c.material && !isNaN(c.percentage));
					} else if (typeof item.composition === 'string' && item.composition.trim()) {
						const parts = item.composition.split(/[,;\n/]+/);
						for (const part of parts) {
							const m1 = part.match(/(\d+(?:\.\d+)?)\s*%\s*(.*)/);
							const m2 = part.match(/(.*?)\s*(\d+(?:\.\d+)?)\s*%/);
							if (m1 && m1[2].trim()) {
								composition.push({ percentage: Number(m1[1]), material: m1[2].trim() });
							} else if (m2 && m2[1].trim()) {
								composition.push({ percentage: Number(m2[2]), material: m2[1].trim() });
							}
						}
					}
					pAny.composition = composition;
				}

				// Care instructions
				if (item.careInstructions !== undefined) {
					if (Array.isArray(item.careInstructions)) {
						pAny.careInstructions = item.careInstructions.map((ci: any) => String(ci).trim()).filter(Boolean);
					} else if (typeof item.careInstructions === 'string' && item.careInstructions.trim()) {
						pAny.careInstructions = item.careInstructions.split(/[,;\n]+/).map((ci: string) => ci.trim()).filter(Boolean);
					}
				}

				// Size Guide (Guía de medidas)
				if (item.sizeGuide !== undefined) {
					if (item.sizeGuide && typeof item.sizeGuide === 'object' && Array.isArray(item.sizeGuide.headers) && Array.isArray(item.sizeGuide.rows) && item.sizeGuide.rows.length > 0) {
						pAny.sizeGuide = {
							headers: item.sizeGuide.headers.map((h: any) => String(h).trim()),
							rows: item.sizeGuide.rows.map((r: any) => ({
								size: String(r.size || '').trim(),
								values: Array.isArray(r.values) ? r.values.map((v: any) => String(v).trim()) : []
							})),
							tolerance: item.sizeGuide.tolerance ? String(item.sizeGuide.tolerance).trim() : undefined
						};
					} else if (item.sizeGuide === null) {
						pAny.sizeGuide = undefined;
					}
				}

				// TechProduct Fields
				if (item.processor !== undefined) pAny.processor = String(item.processor).trim();
				if (item.ram !== undefined) pAny.ram = String(item.ram).trim();
				if (item.screenSize !== undefined) pAny.screenSize = String(item.screenSize).trim();
				if (item.os !== undefined) pAny.os = String(item.os).trim();
				if (item.storage !== undefined) {
					if (Array.isArray(item.storage)) {
						pAny.storage = item.storage.map((s: any) => String(s).trim()).filter(Boolean);
					} else if (typeof item.storage === 'string' && item.storage.trim()) {
						pAny.storage = item.storage.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
					}
				}
				if (item.connectivity !== undefined) {
					if (Array.isArray(item.connectivity)) {
						pAny.connectivity = item.connectivity.map((c: any) => String(c).trim()).filter(Boolean);
					} else if (typeof item.connectivity === 'string' && item.connectivity.trim()) {
						pAny.connectivity = item.connectivity.split(/[,;\n]+/).map((c: string) => c.trim()).filter(Boolean);
					}
				}

				// BeautyProduct Fields
				if (item.volume !== undefined) pAny.volume = String(item.volume).trim();
				if (item.concentration !== undefined) pAny.concentration = String(item.concentration).trim();
				if (item.fragranceFamily !== undefined) pAny.fragranceFamily = String(item.fragranceFamily).trim();
				if (item.applicationArea !== undefined) pAny.applicationArea = String(item.applicationArea).trim();
				if (item.scentNotes !== undefined && typeof item.scentNotes === 'object') {
					pAny.scentNotes = {
						...(pAny.scentNotes || {}),
						top: item.scentNotes.top ? String(item.scentNotes.top).trim() : pAny.scentNotes?.top,
						heart: item.scentNotes.heart ? String(item.scentNotes.heart).trim() : pAny.scentNotes?.heart,
						base: item.scentNotes.base ? String(item.scentNotes.base).trim() : pAny.scentNotes?.base
					};
				}

				// KioskProduct Fields
				if (item.barcode !== undefined) pAny.barcode = String(item.barcode).trim();
				if (item.weight !== undefined) pAny.weight = String(item.weight).trim();
				if (item.unit !== undefined) pAny.unit = String(item.unit).trim();
				if (item.isSoldByWeight !== undefined) pAny.isSoldByWeight = Boolean(item.isSoldByWeight);

				const saved = await product.save();
				updated.push(saved.toObject() as unknown as IProduct);
			} catch (err: any) {
				errors.push({ index: i, _id: item._id, model: item.model || `Ítem #${i + 1}`, error: err.message || 'Error al actualizar producto' });
			}
		}

		return { success: errors.length === 0, updatedCount: updated.length, updated, errors };
	}

	/**
	 * Verifica si ya existe un producto con el mismo link de proveedor (o URL base limpia).
	 * Permite excluir un ID si se está editando un producto existente.
	 */
	static async checkDuplicateBySupplierUrl(
		models: TenantModels,
		url: string,
		excludeId?: string
	): Promise<{ exists: boolean; product?: any }> {
		if (!url || typeof url !== 'string' || !url.trim()) {
			return { exists: false };
		}

		const cleanInput = url.trim();
		let cleanBaseUrl = cleanInput;
		try {
			const parsed = new URL(cleanInput);
			cleanBaseUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
		} catch {
			cleanBaseUrl = cleanInput.split('?')[0].split('#')[0].replace(/\/+$/, '');
		}



		const filter: any = {
			$or: [
				{ linkProductProvider: cleanInput },
				{ linkProductProvider: cleanBaseUrl },
				{ linkProductProvider: { $regex: `^${escapeRegex(cleanBaseUrl)}`, $options: 'i' } },
				{ linkProductProvider: { $regex: escapeRegex(cleanBaseUrl), $options: 'i' } }
			]
		};

		if (excludeId && typeof excludeId === 'string' && excludeId.trim()) {
			filter._id = { $ne: excludeId.trim() };
		}

		const product = await models.Product.findOne(filter)
			.select('+linkProductProvider brand model subtitle category productType status price images variants')
			.lean() as any;

		if (!product) {
			return { exists: false };
		}

		const primaryImage =
			product.images && product.images.length > 0
				? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url || '')
				: '';

		return {
			exists: true,
			product: {
				_id: String(product._id),
				brand: product.brand || '',
				model: product.model || '',
				subtitle: product.subtitle || '',
				category: product.category || '',
				productType: product.productType || 'clothing',
				status: product.status || 'published',
				price: product.price?.listPrice || product.price?.card_ticket1PayPrice || 0,
				image: primaryImage,
				linkProductProvider: product.linkProductProvider || '',
				variantsCount: Array.isArray(product.variants) ? product.variants.length : 0
			}
		};
	}

	static previewBulkRemoveAdditionalCost = ProductPricingService.previewBulkRemoveAdditionalCost;

	static applyBulkRemoveAdditionalCost = ProductPricingService.applyBulkRemoveAdditionalCost;

	static updateProductQuickPricing = ProductPricingService.updateProductQuickPricing;
}


