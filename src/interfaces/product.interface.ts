import { Document, Types } from 'mongoose';
import { IVariant } from './variant.interface';

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
	Numerico = 'Numérico'
}

export enum IProductCategories {
	// Tech
	Electrodomesticos = 'Electrodomésticos',
	Smartphones = 'Smartphones',
	Pantallas = 'TV / Monitores',
	PC = 'PC',
	Consolas = 'Consolas',
	// Clothing
	Remeras = 'Remeras',
	Pantalones = 'Pantalones',
	Buzos = 'Buzos / Hoodies',
	Camperas = 'Camperas',
	Zapatillas = 'Zapatillas',
	Accesorios = 'Accesorios',
	Shorts = 'Shorts'
}

// ============ BASE PRODUCT ============

export interface IProduct {
	_id: string;
	productType: ProductType;
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
	images: IProductImage[];
	features: string[];
	specifications: IProductSpec[];
	variants: IVariant[];
	tags?: string[];
	lowStockThreshold?: number;
	customProfitMargin?: number;
	//TODO: Quitar el precio 
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

// ============ DTOs ============

export interface IProductCreateDTO {
	productType: ProductType;
	brand: string;
	model: string;
	shortDescription: string;
	largeDescription: string;
	price: number;
	customProfitMargin?: number;
	category: IProductCategories;
	features: string | string[];
	specifications: string | IProductSpec[];
	variants: string | IVariant[];
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
}

export interface IProductUpdateDTO extends Partial<IProductCreateDTO> {
	_id: string;
	deletedImages?: string[];
	images?: IProductImage[];
	slug?: string;
	prices?: number | IProductPrices;
}

// ============ DOCUMENT ============

export interface IProductDocument extends Document, Omit<IProduct, 'model' | '_id'> {
	_id: Types.ObjectId;
}
