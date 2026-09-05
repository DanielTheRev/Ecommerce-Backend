import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import {
	ICategoryGroup,
	ICategoryGroupCreateDTO,
	ICategoryGroupUpdateDTO,
	IRawCategoryCount
} from '@/interfaces/categoryGroup.interface';
import { isValidObjectId } from 'mongoose';
import { CacheService } from './cache.service';

export class CategoryGroupService {
	/**
	 * Helper para normalizar textos a slug URL-friendly
	 */
	static slugify(text: string): string {
		return text
			.toString()
			.toLowerCase()
			.trim()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/&/g, '-y-')
			.replace(/[^a-z0-9 -]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	/**
	 * Categorías base por defecto para inicialización automática (Auto-Seed)
	 */
	static getDefaultCategoryGroups(): ICategoryGroupCreateDTO[] {
		return [
			{
				name: 'Abrigos',
				slug: 'abrigos',
				description: 'Macro-categoría que agrupa camperas, poleras, suéteres, buzos, sacos y prendas de abrigo.',
				targetCategories: [
					'Camperas',
					'Poleras',
					'Suéteres',
					'Buzos',
					'Sacos',
					'Chalecos',
					'Chaquetas',
					'Parkas',
					'Tapados',
					'Cardigans',
					'Trench',
					'Anoraks',
					'Camisacos'
				],
				synonyms: [
					'abrigo',
					'abrigos',
					'outerwear',
					'ropa de abrigo',
					'tapado',
					'tapados',
					'chaqueta',
					'chaquetas'
				],
				isActive: true,
				order: 1
			},
			{
				name: 'Camperas',
				slug: 'camperas',
				description: 'Camperas, camperones, parkas, anoraks y chalecos.',
				targetCategories: ['Camperas'],
				synonyms: [
					'campera',
					'camperas',
					'camperon',
					'camperones',
					'jacket',
					'jackets',
					'parka',
					'parkas',
					'anorak',
					'anoraks',
					'chaleco',
					'chalecos'
				],
				isActive: true,
				order: 2
			},
			{
				name: 'Remeras y Tops',
				slug: 'remeras',
				description: 'Remeras clásicas, musculosas, remeras oversize y tops.',
				targetCategories: ['Remeras', 'Musculosas', 'Tops'],
				synonyms: [
					'remera',
					'remeras',
					't-shirt',
					't-shirts',
					'tshirt',
					'tshirts',
					'musculosa',
					'musculosas',
					'top',
					'tops',
					'crop top',
					'crop tops'
				],
				isActive: true,
				order: 3
			},
			{
				name: 'Pantalones y Bottoms',
				slug: 'pantalones',
				description: 'Pantalones, jeans, joggers, shorts, bermudas y calzas.',
				targetCategories: [
					'Pantalones',
					'Jeans',
					'Joggers',
					'Shorts',
					'Bermudas',
					'Calzas',
					'Palazzos'
				],
				synonyms: [
					'pantalon',
					'pantalones',
					'jean',
					'jeans',
					'denim',
					'cargo',
					'cargos',
					'jogger',
					'joggers',
					'short',
					'shorts',
					'bermuda',
					'bermudas',
					'calza',
					'calzas',
					'palazzo',
					'palazzos'
				],
				isActive: true,
				order: 3
			},
			{
				name: 'Buzos y Hoodies',
				slug: 'buzos',
				description: 'Buzos cuello redondo, hoodies y canguros.',
				targetCategories: ['Buzos'],
				synonyms: ['buzo', 'buzos', 'hoodie', 'hoodies', 'canguro', 'sweatshirt'],
				isActive: true,
				order: 4
			},
			{
				name: 'Poleras',
				slug: 'poleras',
				description: 'Poleras de hilo, media polera y polerones.',
				targetCategories: ['Poleras'],
				synonyms: [
					'polera',
					'poleras',
					'poleron',
					'polerones',
					'media polera',
					'medias poleras',
					'turtleneck'
				],
				isActive: true,
				order: 5
			},
			{
				name: 'Suéteres y Cardigans',
				slug: 'sueteres',
				description: 'Suéteres tejidos y cardigans.',
				targetCategories: ['Suéteres', 'Cardigans'],
				synonyms: [
					'sweater',
					'sweaters',
					'sueter',
					'sueteres',
					'cardigan',
					'cardigans',
					'tejido',
					'tejidos',
					'knitwear'
				],
				isActive: true,
				order: 6
			},
			{
				name: 'Camisas y Blusas',
				slug: 'camisas',
				description: 'Camisas formales, casuales y blusas.',
				targetCategories: ['Camisas', 'Blusas'],
				synonyms: ['camisa', 'camisas', 'blusa', 'blusas', 'camisola', 'camisolas', 'shirt', 'shirts'],
				isActive: true,
				order: 7
			},
			{
				name: 'Chombas y Polos',
				slug: 'chombas',
				description: 'Chombas de piqué y polos.',
				targetCategories: ['Chombas'],
				synonyms: ['chomba', 'chombas', 'polo', 'polos'],
				isActive: true,
				order: 8
			},
			{
				name: 'Calzado',
				slug: 'calzado',
				description: 'Zapatillas, botas, zapatos y sandalias.',
				targetCategories: ['Calzado', 'Zapatillas', 'Botas', 'Sandalias'],
				synonyms: [
					'calzado',
					'calzados',
					'zapatilla',
					'zapatillas',
					'sneaker',
					'sneakers',
					'zapato',
					'zapatos',
					'bota',
					'botas',
					'botineta',
					'sandalia',
					'sandalias',
					'shoes'
				],
				isActive: true,
				order: 9
			},
			{
				name: 'Accesorios',
				slug: 'accesorios',
				description: 'Gorras, mochilas, bolsos, cinturones y otros accesorios.',
				targetCategories: ['Accesorios'],
				synonyms: [
					'accesorio',
					'accesorios',
					'gorra',
					'gorras',
					'cap',
					'caps',
					'bag',
					'bags',
					'mochila',
					'mochilas',
					'cinturon',
					'cinturones',
					'billetera',
					'billeteras',
					'medias'
				],
				isActive: true,
				order: 10
			}
		];
	}

	/**
	 * Obtiene todos los grupos de categorías del tenant (con cache)
	 */
	static async getCategoryGroups(
		models: TenantModels,
		tenantSlug: string = 'global'
	): Promise<ICategoryGroup[]> {
		try {
			const cacheKey = 'category-groups:list';
			const cached = CacheService.get<ICategoryGroup[]>(tenantSlug, cacheKey);
			if (cached) return cached;

			let groups = (await models.CategoryGroup.find()
				.sort({ order: 1, createdAt: 1 })
				.lean()) as unknown as ICategoryGroup[];

			// Auto-seed si la colección está vacía
			if (!groups || groups.length === 0) {
				const defaults = this.getDefaultCategoryGroups();
				await models.CategoryGroup.insertMany(defaults);
				groups = (await models.CategoryGroup.find()
					.sort({ order: 1, createdAt: 1 })
					.lean()) as unknown as ICategoryGroup[];
			}

			CacheService.set(tenantSlug, cacheKey, groups, 15 * 60 * 1000);
			return groups;
		} catch (error) {
			console.error('Error al obtener category groups:', error);
			return this.getDefaultCategoryGroups() as unknown as ICategoryGroup[];
		}
	}

	/**
	 * Obtiene solo los grupos activos para resolución del motor de búsqueda
	 */
	static async getActiveGroups(
		models: TenantModels,
		tenantSlug: string = 'global'
	): Promise<ICategoryGroup[]> {
		const groups = await this.getCategoryGroups(models, tenantSlug);
		return groups.filter(g => g.isActive !== false);
	}

	/**
	 * Obtiene un grupo por slug o ID
	 */
	static async getCategoryGroupByIdOrSlug(
		models: TenantModels,
		idOrSlug: string,
		tenantSlug: string = 'global'
	): Promise<ICategoryGroup | null> {
		try {
			const normalized = idOrSlug.trim().toLowerCase();
			const groups = await this.getCategoryGroups(models, tenantSlug);
			const found = groups.find(
				g => g.slug === normalized || (g._id && g._id.toString() === idOrSlug)
			);
			if (found) return found;

			let query: any = { slug: normalized };
			if (isValidObjectId(idOrSlug)) {
				query = { $or: [{ slug: normalized }, { _id: idOrSlug }] };
			}

			const group = (await models.CategoryGroup.findOne(query).lean()) as unknown as ICategoryGroup | null;
			return group;
		} catch (error) {
			console.error(`Error al buscar grupo ${idOrSlug}:`, error);
			return null;
		}
	}

	/**
	 * Obtiene todas las categorías directas/reales registradas en los productos del tenant, con su conteo.
	 */
	static async getDistinctRawCategories(models: TenantModels): Promise<IRawCategoryCount[]> {
		try {
			const results = await models.Product.aggregate([
				{
					$match: {
						category: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] }
					}
				},
				{
					$group: {
						_id: '$category',
						count: { $sum: 1 }
					}
				},
				{
					$sort: { count: -1, _id: 1 }
				}
			]);

			return results.map(r => ({
				category: String(r._id).trim(),
				count: Number(r.count) || 0
			}));
		} catch (error) {
			console.error('Error al obtener categorías raw de productos:', error);
			return [];
		}
	}

	/**
	 * Crea un nuevo grupo de categorías
	 */
	static async createCategoryGroup(
		models: TenantModels,
		data: ICategoryGroupCreateDTO,
		tenantSlug: string = 'global'
	): Promise<ICategoryGroup> {
		if (!data.name?.trim()) {
			throw new AppError(
				'El nombre de la categoría es requerido.',
				'El nombre de la categoría es requerido.',
				400
			);
		}

		const slug = data.slug?.trim() ? this.slugify(data.slug) : this.slugify(data.name);
		const existing = await models.CategoryGroup.findOne({ slug }).lean();
		if (existing) {
			throw new AppError(
				`Ya existe un grupo de categoría con el identificador "${slug}".`,
				`Ya existe un grupo de categoría con el identificador "${slug}".`,
				400
			);
		}

		const cleanTargetCategories = Array.isArray(data.targetCategories)
			? Array.from(new Set(data.targetCategories.map(c => c.trim()).filter(Boolean)))
			: [];

		const cleanSynonyms = Array.isArray(data.synonyms)
			? Array.from(new Set(data.synonyms.map(s => s.trim().toLowerCase()).filter(Boolean)))
			: [];

		const newGroup = await models.CategoryGroup.create({
			name: data.name.trim(),
			slug,
			description: data.description?.trim() || '',
			targetCategories: cleanTargetCategories,
			synonyms: cleanSynonyms,
			isActive: data.isActive !== false,
			order: data.order !== undefined ? Number(data.order) : 0
		});

		// Invalidar caché
		CacheService.invalidatePrefix(tenantSlug, 'category-groups');
		CacheService.invalidatePrefix(tenantSlug, 'products');

		return newGroup.toObject() as unknown as ICategoryGroup;
	}

	/**
	 * Actualiza un grupo de categorías existente
	 */
	static async updateCategoryGroup(
		models: TenantModels,
		id: string,
		data: ICategoryGroupUpdateDTO,
		tenantSlug: string = 'global'
	): Promise<ICategoryGroup> {
		const group = await models.CategoryGroup.findById(id);
		if (!group) {
			throw new AppError(
				'Grupo de categoría no encontrado.',
				'Grupo de categoría no encontrado.',
				404
			);
		}

		if (data.name) group.name = data.name.trim();

		if (data.slug) {
			const slug = this.slugify(data.slug);
			if (slug !== group.slug) {
				const existing = await models.CategoryGroup.findOne({
					slug,
					_id: { $ne: id }
				}).lean();
				if (existing) {
					throw new AppError(
						`Ya existe otro grupo con el identificador "${slug}".`,
						`Ya existe otro grupo con el identificador "${slug}".`,
						400
					);
				}
				group.slug = slug;
			}
		}

		if (data.description !== undefined) group.description = data.description.trim();

		if (data.targetCategories !== undefined && Array.isArray(data.targetCategories)) {
			group.targetCategories = Array.from(
				new Set(data.targetCategories.map(c => c.trim()).filter(Boolean))
			);
		}

		if (data.synonyms !== undefined && Array.isArray(data.synonyms)) {
			group.synonyms = Array.from(
				new Set(data.synonyms.map(s => s.trim().toLowerCase()).filter(Boolean))
			);
		}

		if (data.isActive !== undefined) group.isActive = data.isActive;
		if (data.order !== undefined) group.order = Number(data.order);

		await group.save();

		// Invalidar caché
		CacheService.invalidatePrefix(tenantSlug, 'category-groups');
		CacheService.invalidatePrefix(tenantSlug, 'products');

		return group.toObject() as unknown as ICategoryGroup;
	}

	/**
	 * Elimina un grupo de categorías
	 */
	static async deleteCategoryGroup(
		models: TenantModels,
		id: string,
		tenantSlug: string = 'global'
	): Promise<void> {
		const group = await models.CategoryGroup.findByIdAndDelete(id);
		if (!group) {
			throw new AppError(
				'Grupo de categoría no encontrado.',
				'Grupo de categoría no encontrado.',
				404
			);
		}

		// Invalidar caché
		CacheService.invalidatePrefix(tenantSlug, 'category-groups');
		CacheService.invalidatePrefix(tenantSlug, 'products');
	}
}
