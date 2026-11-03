import { Types } from 'mongoose';
import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { ClothingGender, IProduct, ProductType } from '@/interfaces/product.interface';
import { ICategoryGroup } from '@/interfaces/categoryGroup.interface';
import { escapeRegex } from '@/utils/regex.util';
import { paginate } from '@/utils/pagination.util';
import { CategoryGroupService } from '../categoryGroup.service';
import { EcommerceService, DEFAULT_RECOMMENDATION_RULES } from '../ecommerce.service';
import { getProductModel } from './productModel.helper';
import { ProductDisplayService } from './productDisplay.service';

export class ProductSearchService {
	/**
	 * Construye la query de categoría en MongoDB resolviendo de forma dinámica
	 * macro-categorías, sinónimos y grupos definidos por el merchant en el Panel.
	 */
	public static async buildCategoryQuery(
		models: TenantModels,
		categoryParam: string,
		tenantSlug: string = 'global'
	): Promise<any> {
		const rawCategories = categoryParam
			.split(',')
			.map((c) => c.trim())
			.filter(Boolean);
		const expandedCategories = new Set<string>();

		// 1. Obtener grupos de categoría activos de la base de datos (con cache RAM sub-ms)
		let activeGroups: ICategoryGroup[] = [];
		try {
			activeGroups = await CategoryGroupService.getActiveGroups(models, tenantSlug);
		} catch (err) {
			console.error('Error al obtener grupos de categoría para query:', err);
		}

		// 2. Construir mapas separados por prioridad de coincidencia
		const slugMap = new Map<string, string[]>();
		const nameMap = new Map<string, string[]>();
		const synonymMap = new Map<string, string[]>();

		for (const group of activeGroups) {
			const targets =
				group.targetCategories && group.targetCategories.length > 0
					? group.targetCategories
					: [group.name];

			const cleanSlug = group.slug.toLowerCase().trim();
			const cleanName = group.name.toLowerCase().trim();
			const cleanNameNormalized = cleanName
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '');

			slugMap.set(cleanSlug, targets);
			nameMap.set(cleanName, targets);
			nameMap.set(cleanNameNormalized, targets);

			for (const syn of group.synonyms || []) {
				const cleanSyn = syn.toLowerCase().trim();
				const cleanSynNormalized = cleanSyn
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '');
				if (cleanSyn) {
					const cur = synonymMap.get(cleanSyn) || [];
					synonymMap.set(cleanSyn, Array.from(new Set([...cur, ...targets])));
				}
				if (cleanSynNormalized) {
					const cur = synonymMap.get(cleanSynNormalized) || [];
					synonymMap.set(cleanSynNormalized, Array.from(new Set([...cur, ...targets])));
				}
			}
		}

		for (const cat of rawCategories) {
			const directKey = cat.toLowerCase().trim();
			const normalizedKey = directKey.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

			// PRIORIDAD 1: Coincidencia con SLUG exacto de grupo
			if (slugMap.has(directKey)) {
				slugMap.get(directKey)!.forEach((c) => expandedCategories.add(c));
			} else if (slugMap.has(normalizedKey)) {
				slugMap.get(normalizedKey)!.forEach((c) => expandedCategories.add(c));
			}
			// PRIORIDAD 2: Coincidencia con NOMBRE exacto de grupo
			else if (nameMap.has(directKey)) {
				nameMap.get(directKey)!.forEach((c) => expandedCategories.add(c));
			} else if (nameMap.has(normalizedKey)) {
				nameMap.get(normalizedKey)!.forEach((c) => expandedCategories.add(c));
			}
			// PRIORIDAD 3: Coincidencia con SINÓNIMO de grupo
			else if (synonymMap.has(directKey)) {
				synonymMap.get(directKey)!.forEach((c) => expandedCategories.add(c));
			} else if (synonymMap.has(normalizedKey)) {
				synonymMap.get(normalizedKey)!.forEach((c) => expandedCategories.add(c));
			}
			// PRIORIDAD 4: Coincidencia directa con categoría real
			else {
				expandedCategories.add(cat);
			}
		}

		const catList = Array.from(expandedCategories);
		const regexes = catList.map(
			(c) => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
		);

		if (regexes.length === 1) {
			return regexes[0];
		}
		return { $in: regexes };
	}

	/**
	 * Motor de Recomendaciones Inteligentes (Outfit & Combo Builder con Afinidad de Proveedor)
	 */
	static async getRecommendationsForProduct(
		models: TenantModels,
		slug: string,
		limitOverride?: number
	): Promise<IProduct[]> {
		try {
			// 1. Obtener producto origen con provider, manualRecommendations y combineWith
			const sourceProduct = (await models.Product.findOne({ slug, status: 'published' })
				.select('+provider +manualRecommendations +recommendationsMode +combineWith')
				.populate({
					path: 'combineWith.product',
					select:
						'model brand price salePrice images category status slug fit variants isFeatured productType gender',
					match: { status: 'published' }
				})
				.lean()) as unknown as IProduct;

			if (!sourceProduct) {
				throw new AppError('Product not found', 'Producto no encontrado', 404);
			}

			// 2. Obtener configuración del e-commerce
			const config = await EcommerceService.getConfig(models).catch(() => null);
			const recommendationConfig = config?.recommendationConfig;
			const limit = limitOverride || recommendationConfig?.limit || 8;

			// 3. Caso MANUAL: Si el producto tiene configurado modo manual y posee recomendaciones
			const rawSource = sourceProduct as any;
			if (
				rawSource.recommendationsMode === 'manual' &&
				Array.isArray(rawSource.manualRecommendations) &&
				rawSource.manualRecommendations.length > 0
			) {
				const manualProducts = (await models.Product.find({
					_id: {
						$in: rawSource.manualRecommendations.map((id: any) => new Types.ObjectId(id))
					},
					status: 'published'
				})
					.limit(limit)
					.lean()) as unknown as IProduct[];

				if (manualProducts.length > 0) {
					return manualProducts;
				}
			}

			const excludeIds = [sourceProduct._id.toString()];
			const recommendations: IProduct[] = [];
			const selectedIdsSet = new Set<string>(excludeIds);

			// 3.5. Caso COMBINE WITH (Outfit de la foto / Shop the Look de la prenda)
			if (Array.isArray(rawSource.combineWith) && rawSource.combineWith.length > 0) {
				for (const item of rawSource.combineWith) {
					if (recommendations.length >= limit) break;
					const p = item.product || item;
					if (p && typeof p === 'object' && p._id && p.status === 'published') {
						const pId = p._id.toString();
						if (!selectedIdsSet.has(pId)) {
							selectedIdsSet.add(pId);
							recommendations.push({
								...p,
								targetColor: item.color || null
							});
						}
					}
				}
			}

			if (recommendations.length >= limit) {
				return recommendations;
			}

			// 4. Caso AUTOMÁTICO INTELIGENTE (Outfit & Combo Builder con Afinidad de Proveedor)
			const customRules = recommendationConfig?.rules || {};
			let targetCategories: string[] = [];

			if (
				customRules[sourceProduct.category] &&
				Array.isArray(customRules[sourceProduct.category]) &&
				customRules[sourceProduct.category].length > 0
			) {
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
					const matchedKey = Object.keys(DEFAULT_RECOMMENDATION_RULES).find((key) =>
						normalizedCatKey.includes(key)
					);
					if (matchedKey) {
						targetCategories = DEFAULT_RECOMMENDATION_RULES[matchedKey];
					} else {
						const allCategories = (await models.Product.distinct('category', {
							status: 'published'
						})) as string[];
						targetCategories = allCategories.filter((c: string) => c !== sourceProduct.category);
						targetCategories.push(sourceProduct.category);
					}
				}
			}

			// 5. Filtro por Género (para indumentaria)
			const genderFilter: any = {};
			if (sourceProduct.productType === ProductType.CLOTHING && rawSource.gender) {
				if (rawSource.gender !== ClothingGender.Unisex) {
					genderFilter.gender = { $in: [rawSource.gender, ClothingGender.Unisex] };
				}
			}

			const providerId = rawSource.provider
				? rawSource.provider._id
					? rawSource.provider._id.toString()
					: rawSource.provider.toString()
				: null;

			// 6. Slots de Categorías con prioridad de MISMO PROVEEDOR
			// PASO A: Llenar cada slot de categoría buscando primero productos del mismo proveedor
			for (const cat of targetCategories) {
				if (recommendations.length >= limit) break;

				if (providerId) {
					const sameProviderQuery: any = {
						status: 'published',
						category: cat,
						provider: new Types.ObjectId(providerId),
						_id: { $nin: Array.from(selectedIdsSet).map((id) => new Types.ObjectId(id)) },
						...genderFilter
					};

					const sameProviderProducts = (await models.Product.find(sameProviderQuery)
						.sort({ isFeatured: -1, 'price.cashTransferPrice': -1 })
						.limit(1)
						.lean()) as unknown as IProduct[];

					for (const p of sameProviderProducts) {
						if (recommendations.length >= limit) break;
						const pId = p._id.toString();
						if (!selectedIdsSet.has(pId)) {
							selectedIdsSet.add(pId);
							recommendations.push(p);
						}
					}
				}
			}

			// PASO B: Si faltan items para el límite, completar los slots con otros proveedores
			for (const cat of targetCategories) {
				if (recommendations.length >= limit) break;

				const remainingLimit = limit - recommendations.length;
				const remainingCategories = targetCategories.length - targetCategories.indexOf(cat);
				const perCatLimit = Math.max(
					1,
					Math.ceil(remainingLimit / Math.max(1, remainingCategories))
				);

				const otherProviderQuery: any = {
					status: 'published',
					category: cat,
					_id: { $nin: Array.from(selectedIdsSet).map((id) => new Types.ObjectId(id)) },
					...genderFilter
				};

				const otherProducts = (await models.Product.find(otherProviderQuery)
					.sort({ isFeatured: -1, 'price.cashTransferPrice': -1 })
					.limit(perCatLimit)
					.lean()) as unknown as IProduct[];

				for (const p of otherProducts) {
					if (recommendations.length >= limit) break;
					const pId = p._id.toString();
					if (!selectedIdsSet.has(pId)) {
						selectedIdsSet.add(pId);
						recommendations.push(p);
					}
				}
			}

			// PASO C: Fallback final en caso de que aún falten items
			if (recommendations.length < limit) {
				const remainingCount = limit - recommendations.length;
				const fallbackQuery: any = {
					status: 'published',
					_id: { $nin: Array.from(selectedIdsSet).map((id) => new Types.ObjectId(id)) },
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
			throw new AppError(
				'Failed to fetch recommendations',
				'Error al obtener las recomendaciones',
				500
			);
		}
	}

	static async getSearchSuggestions(
		models: TenantModels,
		queryText: string,
		limit: number = 10,
		productType?: string
	): Promise<IProduct[]> {
		try {
			const Model = getProductModel(models, productType);
			const escapedQuery = escapeRegex(queryText);
			const query = {
				status: 'published',
				$or: [
					{ brand: { $regex: escapedQuery, $options: 'i' } },
					{ model: { $regex: escapedQuery, $options: 'i' } }
				]
			};
			const products = (await Model.find(query)
				.sort({ 'price.cashTransferPrice': -1 })
				.limit(limit)
				.lean()) as unknown as IProduct[];
			return products;
		} catch (error) {
			throw new AppError('Failed to get suggestions', 'Error al obtener sugerencias', 500);
		}
	}

	static async getProductMetadata(models: TenantModels, productType?: string) {
		const Model = getProductModel(models, productType);
		const matchQuery: any = { status: 'published' };
		if (productType) {
			matchQuery.productType = productType;
		}

		try {
			const [brands, categories, tags, rawFits, rawSizesAggregation] = await Promise.all([
				Model.distinct('brand', matchQuery),
				Model.distinct('category', matchQuery),
				Model.distinct('tags', matchQuery),
				Model.distinct('fit', matchQuery),
				Model.aggregate([
					{ $match: matchQuery },
					{ $unwind: '$variants' },
					{ $match: { 'variants.stock': { $gt: 0 }, 'variants.isActive': { $ne: false } } },
					{ $group: { _id: '$variants.size' } }
				])
			]);
			const cleanBrands = (brands || []).filter(Boolean);
			const cleanCategories = (categories || []).filter(Boolean);
			const cleanTags = (tags || []).filter(Boolean);
			const cleanFits = (rawFits || [])
				.map((f: any) => (typeof f === 'string' ? f.trim() : ''))
				.filter((f: string) => Boolean(f));

			const letterOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
			const rawSizes = (rawSizesAggregation || []).map((s: any) => s._id);
			const normalizedSizesSet = new Set<string>();

			for (const sz of rawSizes) {
				if (!sz || typeof sz !== 'string') continue;
				const trimmed = sz.trim();
				if (!trimmed) continue;
				if (trimmed.toLowerCase() === 'único' || trimmed.toLowerCase() === 'unico') {
					normalizedSizesSet.add('Único');
				} else {
					normalizedSizesSet.add(trimmed.toUpperCase());
				}
			}

			const sortedSizes = Array.from(normalizedSizesSet).sort((a, b) => {
				const aLetterIdx = letterOrder.indexOf(a);
				const bLetterIdx = letterOrder.indexOf(b);

				if (aLetterIdx !== -1 && bLetterIdx !== -1) return aLetterIdx - bLetterIdx;
				if (aLetterIdx !== -1) return -1;
				if (bLetterIdx !== -1) return 1;

				const aNum = Number(a);
				const bNum = Number(b);
				const aIsNum = !isNaN(aNum) && a !== '';
				const bIsNum = !isNaN(bNum) && b !== '';

				if (aIsNum && bIsNum) return aNum - bNum;
				if (aIsNum) return -1;
				if (bIsNum) return 1;

				if (a === 'Único') return 1;
				if (b === 'Único') return -1;

				return a.localeCompare(b);
			});

			return {
				brands: cleanBrands,
				categories: cleanCategories,
				tags: cleanTags,
				fits: Array.from(new Set(cleanFits)),
				sizes: sortedSizes
			};
		} catch (error) {
			throw new AppError('Failed to fetch metadata', 'Error al obtener metadata', 500);
		}
	}

	static async searchProducts(data: {
		models: TenantModels;
		filters: {
			q?: string;
			minPrice?: number;
			maxPrice?: number;
			minRating?: number;
			category?: string;
			brand?: string;
			gender?: string;
			tags?: string;
			fit?: string;
			size?: string;
			featured?: boolean;
			sortBy?: 'createdAt' | 'price' | string;
			sortOrder?: 'asc' | 'desc' | string;
			interleave?: boolean;
			splitColors?: boolean;
		};
		page?: number;
		limit?: number;
		productType?: string;
	}) {
		const { models, filters, page = 1, limit = 10, productType } = data;
		try {
			const Model = getProductModel(models, productType);
			const query: any = {};

			query.status = 'published';

			if (filters.featured) {
				query.isFeatured = filters.featured;
			}

			const andConditions: any[] = [];

			if (filters.q) {
				const qRegex = new RegExp(filters.q.trim(), 'i');
				andConditions.push({
					$or: [
						{ brand: qRegex },
						{ model: qRegex },
						{ category: qRegex },
						{ clothingType: qRegex },
						{ tags: qRegex },
						{ 'variants.sku': qRegex },
						{ 'variants.barcode': qRegex },
						{ barcode: qRegex }
					]
				});
			}

			if (filters.category) {
				const catQuery = await this.buildCategoryQuery(models, filters.category);
				andConditions.push({
					$or: [{ category: catQuery }, { clothingType: catQuery }]
				});
			}

			if (filters.fit) {
				const fits = filters.fit
					.split(',')
					.map((f) => f.trim())
					.filter(Boolean);
				if (fits.length === 1) {
					andConditions.push({ fit: new RegExp(`^${fits[0]}$`, 'i') });
				} else if (fits.length > 1) {
					andConditions.push({ fit: { $in: fits.map((f) => new RegExp(`^${f}$`, 'i')) } });
				}
			}

			if (filters.size) {
				const sizes = filters.size
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean);
				if (sizes.length > 0) {
					const sizeRegexes = sizes.map((s) => new RegExp(`^${s}$`, 'i'));
					andConditions.push({
						variants: {
							$elemMatch: {
								size: { $in: sizeRegexes },
								stock: { $gt: 0 },
								isActive: { $ne: false }
							}
						}
					});
				}
			}

			if (andConditions.length > 0) {
				query.$and = andConditions;
			}

			if (filters.minPrice || filters.maxPrice) {
				query['price.cashTransferPrice'] = {};
				if (filters.minPrice) query['price.cashTransferPrice'].$gte = filters.minPrice;
				if (filters.maxPrice) query['price.cashTransferPrice'].$lte = filters.maxPrice;
			}

			if (filters.minRating) {
				query.rating = { $gte: filters.minRating };
			}

			if (filters.brand) {
				const brands = filters.brand.split(',').map((b) => b.trim());
				query.brand = { $in: brands };
			}

			if (filters.gender) {
				const genders = filters.gender.split(',').map((g) => g.trim());
				query.gender = { $in: genders };
			}

			if (filters.tags) {
				const tags = filters.tags.split(',').map((t) => t.trim());
				query.tags = { $in: tags };
			}

			// Determinar ordenamiento según configuración y filtros del usuario
			const storeConfig = await EcommerceService.getConfig(models);
			const isRankingActive = storeConfig.catalogRanking?.active === true;

			let sortCriteria: Record<string, 1 | -1> = {};

			if (filters.sortBy === 'price') {
				sortCriteria = { 'price.cashTransferPrice': filters.sortOrder === 'asc' ? 1 : -1 };
			} else if (filters.sortBy === 'createdAt') {
				sortCriteria = { createdAt: filters.sortOrder === 'asc' ? 1 : -1 };
			} else if (filters.sortBy === 'ranking' || (isRankingActive && !filters.sortBy)) {
				// ALGORITMO ELO DINÁMICO (activo en tienda o forzado para preview)
				sortCriteria = { effectiveScore: -1, isFeatured: -1, createdAt: -1 };
			} else {
				// Fallback tradicional por precio
				sortCriteria = { 'price.cashTransferPrice': -1 };
			}

			const result = await paginate(Model, query, {
				page,
				limit,
				sort: sortCriteria
			});

			// 1. Desdoblamiento virtual por color (si está habilitado)
			if (filters.splitColors && Array.isArray(result.data) && result.data.length > 0) {
				result.data = ProductDisplayService.splitProductsByColor(
					result.data as unknown as IProduct[],
					filters.size
				) as any;
			}

			// 2. Cadencia visual / Interleaving con Anti-Clustering:
			const shouldInterleave =
				filters.interleave !== false && !filters.category && filters.sortBy !== 'price';

			if (shouldInterleave && Array.isArray(result.data) && result.data.length > 2) {
				result.data = ProductDisplayService.interleaveProducts(
					result.data as unknown as IProduct[]
				) as any;
			}

			return result;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Failed to search products', 'Error al buscar productos', 500);
		}
	}
}
