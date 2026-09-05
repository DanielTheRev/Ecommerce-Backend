import { Document, Types } from 'mongoose';

export interface ICategoryGroup {
	_id?: Types.ObjectId | string;
	name: string;
	slug: string;
	description?: string;
	targetCategories: string[];
	synonyms: string[];
	isActive: boolean;
	order: number;
	createdAt?: Date;
	updatedAt?: Date;
}

export type ICategoryGroupDocument = ICategoryGroup & Document;

export interface ICategoryGroupCreateDTO {
	name: string;
	slug?: string;
	description?: string;
	targetCategories: string[];
	synonyms?: string[];
	isActive?: boolean;
	order?: number;
}

export interface ICategoryGroupUpdateDTO {
	name?: string;
	slug?: string;
	description?: string;
	targetCategories?: string[];
	synonyms?: string[];
	isActive?: boolean;
	order?: number;
}

export interface IRawCategoryCount {
	category: string;
	count: number;
}
