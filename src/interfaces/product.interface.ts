import { Document, ObjectId } from 'mongoose';

export interface IProduct {
	_id: string;
	slug: string;
	category: IProductCategories;
	shortDescription: string;
	largeDescription: string;
	brand: string;
	model: string;
	prices: IProductPrices;
	discount: number;
	rating: number | null;
	reviews: number | null;
	stock: number;
	images: IProductImage[];
	features: string[];
	colors: string[];
	storage: string[];
	specifications: IProductSpec[];
}

export interface IProductImage {
	url: string;
	public_id: string;
	width?: number;
	height?: number;
}

export enum IProductCategories {
	Electrodomesticos = 'Electrodomésticos',
	Smartphones = 'Smartphones',
	Pantallas = 'TV / Monitores',
	PC = 'PC',
	Consolas = 'Consolas'
}

export interface IProductPrices {
	costPrice: {
		inUSD: number;
		inARS: number;
	};
	dolarPrice: number;
	profitMargin: number;
	baseCommission: number;
	cft6Cuotas: number;
	efectivo_transferencia: number;
	tarjeta_credito_debito: number;
	cuotas: {
		cuotas_3_si: number;
		cuotas_6_si: number;
	};
	earnings?: {
		cash_transfer: number;
		card_3_installments: number;
		card_6_installments: number;
	};
}

export interface IProductCreateDTO {
	brand: string;
	shortDescription: string;
	largeDescription: string;
	model: string;
	price: number;
	category: IProductCategories;
	colors: string | string[];
	storage: string | string[];
	features: string | string[];
	specifications: string | IProductSpec[];
}

export interface IProductSpec {
	key: string;
	value: string;
}

export interface IProductUpdateDTO extends Partial<IProductCreateDTO> {
	_id: string;
	deletedImages?: string[];
	images?: IProductImage[];
	slug?: string;
	prices?: number | IProductPrices;
}

export interface IProductDocument extends Document, Omit<IProduct, 'model' | '_id'> {
	_id: ObjectId;
}
