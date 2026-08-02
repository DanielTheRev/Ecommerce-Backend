import { Document } from 'mongoose';

export interface INewsletter {
	_id: string;
	email: string;
	isActive: boolean;
	subscribedAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface INewsletterDocument extends Document, Omit<INewsletter, '_id'> {}
