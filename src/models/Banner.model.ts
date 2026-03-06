import { IBanner } from '@/interfaces/home.interface';
import mongoose, { Document, Schema } from 'mongoose';



const BannerSchema = new Schema(
	{
		brandName: { type: String, required: true, unique: true },
		description: { type: String, required: true },
		image: { type: String, required: true },
		title: { type: String, required: true },
		subtitle: { type: String, required: true },
		
		textClass: { type: String, default: 'text-white' },
		buttonClass: { type: String, default: 'bg-white text-black' },
		icon: { type: String, default: 'Smartphone' },

		isActive: { type: Boolean, default: true },
		order: { type: Number, default: 0 }
	},
	{
		timestamps: true,
		versionKey: false
	}
);

// Index for faster queries when sorting by order
BannerSchema.index({ order: 1 });

// Schema exportado para multi-tenancy (model registry)
export { BannerSchema };

export const Banner = mongoose.model<IBanner>('Banner', BannerSchema);
