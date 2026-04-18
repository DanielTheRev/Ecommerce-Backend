import { Document, Types } from 'mongoose';
import { IClothingVariant, ITechVariant, IVariant } from './variant.interface';
import { IProvider } from './provider.interface';

// ============ ENUMS ============

export enum ProductType {
	TECH = 'TechProduct',
	CLOTHING = 'ClothingProduct'
}

export enum ClothingGender {
	Hombre = 'Hombre',
	Mujer = 'Mujer',
	Unisex = 'Unisex',
	Ninos = 'Niños'
}

export enum ClothingFit {
	Regular = 'Regular',
	Slim = 'Slim',
	Oversized = 'Oversized',
	Relaxed = 'Relaxed'
}

export enum ClothingSizeType {
	Ropa = 'Ropa',
	Calzado = 'Calzado',
	Numerico = 'Numérico',
	Unico = 'Talle Único'
}



// ============ BASE PRODUCT ============

export interface IProduct {
	_id: string;
	productType: ProductType;
	provider: IProvider;
	slug: string;
	category: string;
	shortDescription: string;
	largeDescription: string;
	brand: string;
	model: string;
	prices: IProductPrices;
	discount: number;
	rating: number | null;
	reviews: number | null;
	images: IProductImage[];
	features: string[];
	specifications: IProductSpec[];
	variants: IVariant[]; // tipo mínimo en base — cada discriminador tiene el tipo exacto
	tags?: string[];
	lowStockThreshold?: number;
	isActive: boolean;
	isFeatured: boolean;
	seo: IProductSeo;
}


// ============ TYPE-SPECIFIC PRODUCTS ============

export interface ITechProduct extends IProduct {
	productType: ProductType.TECH;
	storage: string[];
	ram?: string;
	processor?: string;
	screenSize?: string;
	os?: string;
	connectivity?: string[];
	variants: ITechVariant[];
}

export interface IClothingProduct extends IProduct {
	productType: ProductType.CLOTHING;
	gender: ClothingGender;
	fit: ClothingFit;
	material: string;
	composition?: { material: string; percentage: number }[];
	sizeType: ClothingSizeType;
	careInstructions?: string[];
	season?: string;
	variants: IClothingVariant[];
}

// ============ SUB-INTERFACES ============

export interface IProductImage {
	url: string;
	public_id: string;
	width?: number;
	height?: number;
}

export interface IProductSpec {
	key: string;
	value: string;
}

export interface IProductPrices {
	// ── Campos sensibles — select:false en schema (solo admins) ──────────
	costPrice: {
		inUSD: number;
		inARS: number;
	};
	dolarPrice: number;
	profitMargin: number;
	profitMargin1Pay: number;
	profitMarginInstallments: number;
	baseCommission: number;
	cft6Cuotas: number;
	earnings: {
		cash_transfer: number;
		card_1_installments: number;
		card_3_installments: number;
		card_6_installments: number;
		ticket: number;
	};
	// ── Campos públicos — siempre presentes ───────────────────────────────
	efectivo_transferencia: number;
	tarjeta_credito_debito: number;
	cuotas: {
		cuotas_3_si: number;
		cuotas_6_si: number;
	};
}

export interface IProductSeo {
	metaTitle: string;
	metaDescription: string;
	metaImage: {
		url: string,
		public_id: string
	}
}


// ============ DTOs ============

export interface IProductCreateDTO {
	productType: ProductType;
	provider: string;
	brand: string;
	model: string;
	shortDescription: string;
	largeDescription: string;
	price: number;
	customProfitMargin?: number;
	customProfitMargin1Pay?: number;
	customProfitMarginInstallments?: number;
	category: string;
	features: string | string[];
	specifications: string | IProductSpec[];
	variants: string | IClothingVariant[] | ITechVariant[];
	tags?: string | string[];

	// Tech-specific (opcionales a nivel DTO, Mongoose valida por discriminator)
	storage?: string | string[];
	ram?: string;
	processor?: string;
	screenSize?: string;
	os?: string;

	// Clothing-specific (opcionales a nivel DTO, Mongoose valida por discriminator)
	gender?: string;
	fit?: string;
	material?: string;
	composition?: string | { material: string; percentage: number }[];
	sizeType?: string;
	careInstructions?: string | string[];
	seo?: Partial<IProductSeo>;
	season?: string;
}

export interface IProductUpdateDTO extends Partial<IProductCreateDTO> {
	_id: string;
	deletedImages?: string[];
	deletedSeoOgImage?: string;
	images?: IProductImage[];
	slug?: string;
	prices?: number | IProductPrices;
}

// ============ DOCUMENT ============

export interface IProductDocument extends Document, Omit<IProduct, 'model' | '_id'> {
	_id: Types.ObjectId;
}
