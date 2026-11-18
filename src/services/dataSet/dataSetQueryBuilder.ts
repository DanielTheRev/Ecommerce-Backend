import { IDataSetFilter, DataSetMatchType, DataSetSortOption } from '@/interfaces/dataSet.interface';
import { AppError } from '@/errors/app.error';

function escapeRegex(text: string): string {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * DataSetQueryBuilder - SRP (Single Responsibility Principle)
 * Transforma las reglas de un DataSet en queries nativas y optimizadas de MongoDB.
 */
export class DataSetQueryBuilder {
	/**
	 * Construye el filtro de MongoDB ($match) a partir de los filtros y matchType.
	 */
	public static buildFilterQuery(filters: IDataSetFilter[], matchType: DataSetMatchType): Record<string, any> {
		if (!filters || filters.length === 0) {
			return { status: 'published' };
		}

		const clauses: Record<string, any>[] = [];

		for (const filter of filters) {
			const clause = this.buildSingleClause(filter);
			if (clause && Object.keys(clause).length > 0) {
				clauses.push(clause);
			}
		}

		if (clauses.length === 0) {
			return { status: 'published' };
		}

		// Siempre aseguramos que solo traiga productos publicados
		const baseStatus = { status: 'published' };

		if (matchType === 'any') {
			return {
				$and: [
					baseStatus,
					{ $or: clauses }
				]
			};
		}

		// matchType === 'all' (AND)
		return {
			$and: [
				baseStatus,
				...clauses
			]
		};
	}

	/**
	 * Construye la regla de ordenamiento ($sort) de MongoDB.
	 */
	public static buildSortQuery(sortBy?: DataSetSortOption): Record<string, 1 | -1> {
		switch (sortBy) {
			case 'oldest':
				return { createdAt: 1 };
			case 'alphabetical_asc':
				return { name: 1 };
			case 'alphabetical_desc':
				return { name: -1 };
			case 'price_asc':
				return { 'price.cashTransferPrice': 1 };
			case 'price_desc':
				return { 'price.cashTransferPrice': -1 };
			case 'most_sold':
				return { 'metrics.salesCount': -1, createdAt: -1 };
			case 'most_viewed':
				return { 'metrics.viewsCount': -1, createdAt: -1 };
			case 'most_cart_adds':
				return { 'metrics.cartAddsCount': -1, createdAt: -1 };
			case 'newest':
			default:
				return { createdAt: -1 };
		}
	}

	/**
	 * Traduce un filtro individual según su campo y operador.
	 */
	private static buildSingleClause(filter: IDataSetFilter): Record<string, any> {
		const { field, operator, value } = filter;

		switch (field) {
			case 'name':
				return this.buildTextClause('name', operator, value);

			case 'brand':
				return this.buildTextClause('brand', operator, value);

			case 'category':
				if (operator === 'equals') return { category: String(value).trim() };
				if (operator === 'not_equals') return { category: { $ne: String(value).trim() } };
				if (operator === 'in') return { category: { $in: Array.isArray(value) ? value : [value] } };
				if (operator === 'not_in') return { category: { $nin: Array.isArray(value) ? value : [value] } };
				break;

			case 'tags':
				if (operator === 'contains' || operator === 'in' || operator === 'equals') {
					const tagsArr = Array.isArray(value) ? value : [value];
					return { tags: { $in: tagsArr.map((t) => String(t).trim().toLowerCase()) } };
				}
				if (operator === 'not_contains' || operator === 'not_in' || operator === 'not_equals') {
					const tagsArr = Array.isArray(value) ? value : [value];
					return { tags: { $nin: tagsArr.map((t) => String(t).trim().toLowerCase()) } };
				}
				break;

			case 'price':
				return this.buildNumericClause('price.cashTransferPrice', operator, value);

			case 'stockStatus':
				if (value === 'in_stock' || value === true) {
					return { netStock: { $gt: 0 } };
				}
				if (value === 'out_of_stock' || value === false) {
					return { netStock: { $lte: 0 } };
				}
				break;

			// Métricas Pro
			case 'salesCount':
				return this.buildNumericClause('metrics.salesCount', operator, value);

			case 'viewsCount':
				return this.buildNumericClause('metrics.viewsCount', operator, value);

			case 'cartAddsCount':
				return this.buildNumericClause('metrics.cartAddsCount', operator, value);

			case 'entityType':
				// Manejado a nivel de servicio para consultar Products vs ProductBundles
				return {};

			default:
				throw new AppError('Invalid filter field', `El campo de filtro '${field}' no es reconocido.`, 400);
		}

		return {};
	}

	private static buildTextClause(path: string, operator: string, value: any): Record<string, any> {
		const strVal = String(value || '').trim();
		const escaped = escapeRegex(strVal);

		switch (operator) {
			case 'contains':
				return { [path]: { $regex: escaped, $options: 'i' } };
			case 'not_contains':
				return { [path]: { $not: { $regex: escaped, $options: 'i' } } };
			case 'equals':
				return { [path]: { $regex: `^${escaped}$`, $options: 'i' } };
			case 'not_equals':
				return { [path]: { $ne: strVal } };
			default:
				throw new AppError('Invalid text operator', `Operador '${operator}' no soportado para texto.`, 400);
		}
	}

	private static buildNumericClause(path: string, operator: string, value: any): Record<string, any> {
		switch (operator) {
			case 'equals':
				return { [path]: Number(value) };
			case 'not_equals':
				return { [path]: { $ne: Number(value) } };
			case 'greater_than':
				return { [path]: { $gte: Number(value) } };
			case 'less_than':
				return { [path]: { $lte: Number(value) } };
			case 'between':
				if (Array.isArray(value) && value.length === 2) {
					return { [path]: { $gte: Number(value[0]), $lte: Number(value[1]) } };
				}
				throw new AppError('Invalid between range', 'El operador "between" requiere un rango de dos valores [min, max].', 400);
			default:
				throw new AppError('Invalid numeric operator', `Operador '${operator}' no soportado para números.`, 400);
		}
	}
}
