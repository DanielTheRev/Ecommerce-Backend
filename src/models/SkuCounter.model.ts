import mongoose, { Schema, Document } from 'mongoose';

export interface ISkuCounterDocument extends Document {
	category: string;
	lastSequence: number;
}

const SkuCounterSchema = new Schema(
	{
		category: {
			type: String,
			required: true,
			unique: true,
			uppercase: true,
			trim: true
		},
		lastSequence: {
			type: Number,
			default: 0,
			min: 0
		}
	},
	{ timestamps: false, versionKey: false }
);

// Schema exportado para multi-tenancy (model registry)
export { SkuCounterSchema };

export const SkuCounter = mongoose.model<ISkuCounterDocument>('SkuCounter', SkuCounterSchema);
