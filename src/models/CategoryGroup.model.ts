import { Schema, model } from 'mongoose';
import { ICategoryGroupDocument } from '@/interfaces/categoryGroup.interface';

const CategoryGroupSchema = new Schema<ICategoryGroupDocument>(
	{
		name: { type: String, required: true, trim: true },
		slug: { type: String, required: true, trim: true, lowercase: true, index: true },
		description: { type: String, trim: true, default: '' },
		targetCategories: { type: [String], default: [] },
		synonyms: { type: [String], default: [] },
		isActive: { type: Boolean, default: true },
		order: { type: Number, default: 0 }
	},
	{
		timestamps: true,
		versionKey: false
	}
);

export { CategoryGroupSchema };
export const CategoryGroup = model<ICategoryGroupDocument>('CategoryGroup', CategoryGroupSchema);
