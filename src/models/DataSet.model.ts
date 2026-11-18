import { Schema, model } from 'mongoose';
import { IDataSetDocument } from '@/interfaces/dataSet.interface';

const DataSetFilterSchema = new Schema(
	{
		field: {
			type: String,
			required: true,
			enum: [
				'name',
				'category',
				'tags',
				'brand',
				'price',
				'stockStatus',
				'entityType',
				'salesCount',
				'viewsCount',
				'cartAddsCount'
			]
		},
		operator: {
			type: String,
			required: true,
			enum: [
				'equals',
				'not_equals',
				'contains',
				'not_contains',
				'in',
				'not_in',
				'greater_than',
				'less_than',
				'between'
			]
		},
		value: {
			type: Schema.Types.Mixed,
			required: true
		}
	},
	{ _id: false }
);

export const DataSetSchema = new Schema<IDataSetDocument>(
	{
		name: {
			type: String,
			required: [true, 'El nombre del conjunto de datos es obligatorio'],
			trim: true,
			maxlength: 200
		},
		slug: {
			type: String,
			required: [true, 'El slug del conjunto de datos es obligatorio'],
			trim: true,
			lowercase: true,
			index: true
		},
		description: {
			type: String,
			trim: true,
			maxlength: 500
		},
		matchType: {
			type: String,
			enum: ['all', 'any'],
			default: 'all',
			required: true
		},
		filters: {
			type: [DataSetFilterSchema],
			default: []
		},
		sortBy: {
			type: String,
			enum: [
				'newest',
				'oldest',
				'alphabetical_asc',
				'alphabetical_desc',
				'price_asc',
				'price_desc',
				'most_sold',
				'most_viewed',
				'most_cart_adds'
			],
			default: 'newest',
			required: true
		},
		maxItems: {
			type: Number,
			min: 1,
			default: undefined
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

DataSetSchema.index({ slug: 1 });
DataSetSchema.index({ isActive: 1, createdAt: -1 });

export const DataSet = model<IDataSetDocument>('DataSet', DataSetSchema);
