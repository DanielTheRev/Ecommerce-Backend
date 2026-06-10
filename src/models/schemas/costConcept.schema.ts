import { Schema } from 'mongoose';

export const CostConceptSchema = new Schema({
	concept: {
		type: String,
		required: true,
		trim: true
	},
	value: {
		type: Number,
		required: true
	},
	type: {
		type: String,
		enum: ['fixed', 'percent_over_provider'],
		required: true
	}
}, { _id: false });
