import { Document, Types } from 'mongoose';

export type DataSetMatchType = 'all' | 'any';

export type DataSetFilterField =
	| 'name'
	| 'category'
	| 'tags'
	| 'brand'
	| 'price'
	| 'stockStatus'
	| 'entityType' // 'product' | 'bundle' | 'all'
	// Métricas en tiempo real (Exclusivas Plan Pro):
	| 'salesCount'
	| 'viewsCount'
	| 'cartAddsCount';

export type DataSetFilterOperator =
	| 'equals'
	| 'not_equals'
	| 'contains'
	| 'not_contains'
	| 'in'
	| 'not_in'
	| 'greater_than'
	| 'less_than'
	| 'between';

export type DataSetSortOption =
	| 'newest'
	| 'oldest'
	| 'alphabetical_asc'
	| 'alphabetical_desc'
	| 'price_asc'
	| 'price_desc'
	// Métricas en tiempo real (Exclusivas Plan Pro):
	| 'most_sold'
	| 'most_viewed'
	| 'most_cart_adds';

export interface IDataSetFilter {
	field: DataSetFilterField;
	operator: DataSetFilterOperator;
	value: any;
}

export interface IDataSet {
	_id?: Types.ObjectId | string;
	name: string;
	slug: string;
	description?: string;
	matchType: DataSetMatchType; // 'all' (AND) vs 'any' (OR)
	filters: IDataSetFilter[];
	sortBy: DataSetSortOption;
	maxItems?: number; // Límite para banners/carruseles (ej. 10), null/undefined = ilimitado
	isActive: boolean;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface IDataSetDocument extends IDataSet, Document {
	_id: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export interface ICreateDataSetDTO {
	name: string;
	description?: string;
	matchType: DataSetMatchType;
	filters: IDataSetFilter[];
	sortBy?: DataSetSortOption;
	maxItems?: number;
	isActive?: boolean;
}

export interface IUpdateDataSetDTO {
	name?: string;
	description?: string;
	matchType?: DataSetMatchType;
	filters?: IDataSetFilter[];
	sortBy?: DataSetSortOption;
	maxItems?: number;
	isActive?: boolean;
}
