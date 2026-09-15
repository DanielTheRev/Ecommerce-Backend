import { Schema } from 'mongoose';

export const CostConceptSchema = new Schema({
	concept: {
		type: String,
		required: true,
		trim: true
	},
	value: {
		type: Number,
		required: true,
		min: 0
	},
	type: {
		type: String,
		enum: ['fixed', 'percent_over_provider', 'percent_over_price'],
		required: true,
		default: 'fixed'
	},
	category: {
		type: String,
		enum: ['expense', 'tax'],
		default: 'expense'
	}
}, { _id: false });
