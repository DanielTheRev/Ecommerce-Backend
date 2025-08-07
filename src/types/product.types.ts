export interface IProduct {
	id: number;
	slug: string;
	shortDescription: string;
	largeDescription: string;
	brand: string;
	model: string;
	prices: {
		efectivo_transferencia: number;
		tarjeta_credito_debito: number;
		tarjeta_credito_3_cuotas: number;
		tarjeta_credito_6_cuotas: number;
		cuotas: {
			'3_cuotas_sin_interes': number;
			'6_cuotas_sin_interes': number;
		};
	};
	discount: number;
	rating: number | null;
	reviews: number | null;
	stock: number;
	image: {
		light: string;
		dark: string;
	};
	features: string[];
}

export interface IProductCreate {
	_id?: string;
	shortDescription: string;
	largeDescription: string;
	brand: string;
	model: string;
	slug?: string;
	price: number;
	discount: number;
	rating: number;
	reviews: number;
	stock: number;
	image: {
		light: string;
		dark: string;
	};
	features: string[];
}

export interface IProductUpdate extends Partial<IProductCreate> {}
