import { IProductDocument } from '../models/Product';

export interface ICartItemDTO {
	productId: string;
	name: string;
	price: IProductDocument['prices'];
	quantity: number;
	image: string;
}
