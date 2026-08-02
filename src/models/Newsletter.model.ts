import { Schema, model } from 'mongoose';
import { INewsletterDocument } from '@/interfaces/newsletter.interface';

export const NewsletterSchema = new Schema<INewsletterDocument>(
	{
		email: {
			type: String,
			required: [true, 'El email es requerido'],
			unique: true,
			lowercase: true,
			trim: true,
			index: true
		},
		isActive: {
			type: Boolean,
			default: true
		},
		subscribedAt: {
			type: Date,
			default: Date.now
		}
	},
	{
		timestamps: true
	}
);

export const Newsletter = model<INewsletterDocument>('Newsletter', NewsletterSchema);
