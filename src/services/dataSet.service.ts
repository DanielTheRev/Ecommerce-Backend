import slugify from 'slugify';
import { TenantModels } from '@/config/modelRegistry';
import {
	IDataSet,
	IDataSetDocument,
	ICreateDataSetDTO,
	IUpdateDataSetDTO,
	DataSetFilterField,
	DataSetSortOption
} from '@/interfaces/dataSet.interface';
import { DataSetQueryBuilder } from './dataSet/dataSetQueryBuilder';
import { AppError } from '@/errors/app.error';

const PRO_METRIC_FIELDS: DataSetFilterField[] = ['salesCount', 'viewsCount', 'cartAddsCount'];
const PRO_METRIC_SORTS: DataSetSortOption[] = ['most_sold', 'most_viewed', 'most_cart_adds'];

export class DataSetService {
	/**
	 * Valida que los filtros o criterios de ordenamiento por métricas en tiempo real
	 * solo puedan ser utilizados si el comercio posee Plan Pro (Up-sell Gate).
	 */
	private static validateMetricCapabilities(
		filters: Array<{ field: DataSetFilterField }>,
		sortBy?: DataSetSortOption,
		planTier?: string
	): void {
		const isPro = (planTier || '').toLowerCase() === 'pro';

		const hasMetricFilter = filters?.some((f) => PRO_METRIC_FIELDS.includes(f.field));
		const hasMetricSort = sortBy && PRO_METRIC_SORTS.includes(sortBy);

		if ((hasMetricFilter || hasMetricSort) && !isPro) {
			throw new AppError(
				'Metric filtering requires Pro plan',
				'El filtrado y ordenamiento dinámico por métricas en tiempo real (más vendidos, más vistos, más agregados al carrito) requiere Vexx Plan Pro.',
				403
			);
		}
	}

	/**
	 * Genera un slug único para el conjunto de datos dentro del tenant.
	 */
	private static async generateUniqueSlug(models: TenantModels, name: string, currentId?: string): Promise<string> {
		const baseSlug = slugify(name, { lower: true, strict: true, trim: true }) || 'conjunto';
		let slug = baseSlug;
		let counter = 1;

		while (true) {
			const existing = await models.DataSet.findOne({ slug });
			if (!existing || (currentId && existing._id.toString() === currentId)) {
				return slug;
			}
			slug = `${baseSlug}-${counter}`;
			counter++;
		}
	}

	/**
	 * Crea un nuevo conjunto de datos.
	 */
	public static async createDataSet(
		models: TenantModels,
		data: ICreateDataSetDTO,
		planTier?: string
	): Promise<IDataSetDocument> {
		if (!data.name || !data.name.trim()) {
			throw new AppError('Name is required', 'El nombre del conjunto de datos es obligatorio.', 400);
		}

		this.validateMetricCapabilities(data.filters || [], data.sortBy, planTier);

		const slug = await this.generateUniqueSlug(models, data.name);

		const newDataSet = await models.DataSet.create({
			name: data.name.trim(),
			slug,
			description: data.description?.trim(),
			matchType: data.matchType || 'all',
			filters: data.filters || [],
			sortBy: data.sortBy || 'newest',
			maxItems: data.maxItems && data.maxItems > 0 ? data.maxItems : undefined,
			isActive: data.isActive !== undefined ? data.isActive : true
		});

		return newDataSet;
	}

	/**
	 * Actualiza un conjunto de datos existente.
	 */
	public static async updateDataSet(
		models: TenantModels,
		id: string,
		data: IUpdateDataSetDTO,
		planTier?: string
	): Promise<IDataSetDocument> {
		const dataSet = await models.DataSet.findById(id);
		if (!dataSet) {
			throw new AppError('DataSet not found', `No se encontró el conjunto de datos con ID '${id}'.`, 404);
		}

		if (data.filters || data.sortBy) {
			const effectiveFilters = data.filters || dataSet.filters;
			const effectiveSort = data.sortBy || dataSet.sortBy;
			this.validateMetricCapabilities(effectiveFilters, effectiveSort, planTier);
		}

		if (data.name && data.name.trim() !== dataSet.name) {
			dataSet.name = data.name.trim();
			dataSet.slug = await this.generateUniqueSlug(models, data.name, id);
		}

		if (data.description !== undefined) dataSet.description = data.description.trim();
		if (data.matchType !== undefined) dataSet.matchType = data.matchType;
		if (data.filters !== undefined) dataSet.filters = data.filters;
		if (data.sortBy !== undefined) dataSet.sortBy = data.sortBy;
		if (data.maxItems !== undefined) {
			dataSet.maxItems = data.maxItems > 0 ? data.maxItems : undefined;
		}
		if (data.isActive !== undefined) dataSet.isActive = data.isActive;

		await dataSet.save();
		return dataSet;
	}

	/**
	 * Elimina un conjunto de datos.
	 */
	public static async deleteDataSet(models: TenantModels, id: string): Promise<void> {
		const result = await models.DataSet.findByIdAndDelete(id);
		if (!result) {
			throw new AppError('DataSet not found', `No se encontró el conjunto de datos con ID '${id}'.`, 404);
		}
	}

	/**
	 * Obtiene un conjunto de datos por ID o Slug.
	 */
	public static async getDataSetByIdOrSlug(models: TenantModels, idOrSlug: string): Promise<IDataSetDocument> {
		const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
		const dataSet = isObjectId
			? await models.DataSet.findById(idOrSlug)
			: await models.DataSet.findOne({ slug: idOrSlug.toLowerCase() });

		if (!dataSet) {
			throw new AppError('DataSet not found', `No se encontró el conjunto de datos '${idOrSlug}'.`, 404);
		}

		return dataSet;
	}

	/**
	 * Obtiene todos los conjuntos de datos del tenant.
	 */
	public static async getAllDataSets(models: TenantModels, activeOnly = false): Promise<IDataSetDocument[]> {
		const filter = activeOnly ? { isActive: true } : {};
		return models.DataSet.find(filter).sort({ createdAt: -1 });
	}

	/**
	 * Ejecuta la consulta viva de un DataSet y devuelve los productos coincidentes.
	 */
	public static async executeDataSet(
		models: TenantModels,
		idOrSlug: string,
		planTier?: string
	): Promise<{ dataSet: IDataSet; products: any[]; bundles: any[]; totalItems: number }> {
		const dataSet = await this.getDataSetByIdOrSlug(models, idOrSlug);

		if (!dataSet.isActive) {
			return { dataSet, products: [], bundles: [], totalItems: 0 };
		}

		// Validar si el DataSet guardado tiene métricas y el tenant degradó de plan
		this.validateMetricCapabilities(dataSet.filters, dataSet.sortBy, planTier);

		// 1. Construir query nativa de MongoDB para productos individuales
		const productFilterQuery = DataSetQueryBuilder.buildFilterQuery(dataSet.filters, dataSet.matchType);
		const sortQuery = DataSetQueryBuilder.buildSortQuery(dataSet.sortBy);

		// Revisar si el filtro pide solo productos, solo bundles, o ambos
		const entityTypeFilter = dataSet.filters.find((f) => f.field === 'entityType');
		const targetEntity = entityTypeFilter ? entityTypeFilter.value : 'all';

		let products: any[] = [];
		let bundles: any[] = [];

		if (targetEntity === 'product' || targetEntity === 'all') {
			let query = models.Product.find(productFilterQuery).sort(sortQuery);
			if (dataSet.maxItems) {
				query = query.limit(dataSet.maxItems);
			}
			products = await query.exec();
		}

		if (targetEntity === 'bundle' || targetEntity === 'all') {
			// Consultar combos coincidentes
			let bundleQuery = models.ProductBundle.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
			if (dataSet.maxItems) {
				bundleQuery = bundleQuery.limit(dataSet.maxItems);
			}
			bundles = await bundleQuery.populate('items.product').exec();
		}

		return {
			dataSet,
			products,
			bundles,
			totalItems: products.length + bundles.length
		};
	}
}
