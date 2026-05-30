import { Schema } from 'mongoose';

const SizeGuideRowSchema = new Schema({
	size: { type: String, required: true },
	values: [{ type: String, required: true }]
}, { _id: false });

export const SizeGuideSchema = new Schema({
	headers: [{ type: String, required: true }],
	rows: {
		type: [SizeGuideRowSchema],
		required: true,
		validate: [(v: any[]) => v.length > 0, 'Se requiere al menos una fila en la guía de talles']
	},
	tolerance: { type: String }
}, { _id: false });
