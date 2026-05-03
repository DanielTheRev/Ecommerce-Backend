import { Document, Types } from 'mongoose';
import { IProduct } from './product.interface';
import { IUser } from './user.interface';

export interface IFavorite {
	_id: string;
	user: string | IUser;
	product: string | IProduct;
	createdAt: Date;
	updatedAt: Date;
}

export interface IFavoriteDocument extends Document {
	_id: Types.ObjectId;
	user: Types.ObjectId;
	product: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}
