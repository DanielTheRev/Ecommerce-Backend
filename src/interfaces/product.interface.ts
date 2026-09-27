import { Document, Types } from 'mongoose';
import { IClothingVariant, ITechVariant, IVariant } from './variant.interface';
import { IProvider } from './provider.interface';
import { PricingMethod } from './ecommerce.interface';

// ============ ENUMS ============

export enum ProductType {
	TECH = 'TechProduct',
	CLOTHING = 'ClothingProduct',
	BEAUTY = 'BeautyProduct',
	GENERAL = 'GeneralProduct'
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
	Relaxed = 'Relaxed',
	Boxy = 'Boxy',
	Straight = 'Straight',
	Tapered = 'Tapered',
	Baggy = 'Baggy'
}

export enum ClothingSizeType {
	Ropa = 'Ropa',
	Calzado = 'Calzado',
	Numerico = 'Numérico',
	Unico = 'Talle Único'
}

export type ProductStatus = 'published' | 'draft' | 'paused' | 'archived';

export enum ProductStatusEnum {
	PUBLISHED = 'published',
	DRAFT = 'draft',
	PAUSED = 'paused',
	ARCHIVED = 'archived'
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
	subtitle?: string;
	barcode?: string;
	isSoldByWeight?: boolean;
	unit?: string;
	price: IProductPrices;
	finance: IProductFinance;
	discount: number;
	rating: number | null;
	reviews: number | null;
	images: IProductImage[];
	features: string[];
	specifications: IProductSpec[];
	variants: IVariant[]; // tipo mínimo en base — cada discriminador tiene el tipo exacto
	tags?: string[];
	lowStockThreshold?: number;
	status: ProductStatus;
	isFeatured: boolean;
	linkProductProvider?: string;
	seo: IProductSeo;
	recommendationsMode?: 'auto' | 'manual';
	manualRecommendations?: string[] | IProduct[];
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
	fit?: string;
	material: string;
	composition?: { material: string; percentage: number }[];
	sizeType: ClothingSizeType;
	sizeGuide?: ISizeGuide;
	careInstructions?: string[];
	season?: string;
	variants: IClothingVariant[];
	combineWith?: (string | IProduct)[];
}

export interface IBeautyProduct extends IProduct {
	productType: ProductType.BEAUTY;
	volume?: string;
	concentration?: string;
	fragranceFamily?: string;
	gender?: string;
	scentNotes?: {
		top?: string;
		heart?: string;
		base?: string;
	};
	applicationArea?: string;
	variants: IVariant[];
}

export interface IGeneralProduct extends IProduct {
	productType: ProductType.GENERAL;
	barcode?: string;
	isSoldByWeight?: boolean;
	unit?: string;
	weight?: string;
	variants: IVariant[];
}

// ============ SIZE GUIDE ============

export interface ISizeGuideRow {
	size: string;
	values: string[];
}

export interface ISizeGuide {
	headers: string[];
	rows: ISizeGuideRow[];
	tolerance?: string;
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

// export interface IProductPrices {
// 	// ── Campos sensibles — select:false en schema (solo admins) ──────────
// 	costPrice: {
// 		inUSD: number;
// 		inARS: number;
// 	};
// 	dolarPrice: number;
// 	profitMargin: number;
// 	profitMargin1Pay: number;
// 	profitMarginInstallments: number;
// 	baseCommission: number;
// 	cft6Cuotas: number;
// 	/** Override del método de cálculo por producto ('markup' | 'margin'). Si undefined, usa el global. */
// 	customPricingMethod?: PricingMethod;
// 	earnings: {
// 		cash_transfer: number;
// 		card_1_installments: number;
// 		card_3_installments: number;
// 		card_6_installments: number;
// 		ticket: number;
// 	};
// 	// ── Campos públicos — siempre presentes ───────────────────────────────
// 	efectivo_transferencia: number;
// 	tarjeta_credito_debito: number;
// 	cuotas: {
// 		cuotas_3_si: number;
// 		cuotas_6_si: number;
// 	};
// }

export interface ICostConcept {
	concept: string;
	value: number;
	/**
	 * 'fixed': Monto fijo en ARS (Ej: $1.500 de packaging)
	 * 'percent_over_provider': Porcentaje sobre el costo del proveedor (Ej: 10% flete)
	 * 'percent_over_price': Porcentaje sobre el precio de venta (Ej: 3.5% IIBB, 1.2% Ley Cheque)
	 */
	type: 'fixed' | 'percent_over_provider' | 'percent_over_price';
	/**
	 * 'expense': Gasto operativo (packaging, etiquetas)
	 * 'tax': Impuesto o retención fiscal (IIBB, etc.)
	 * 'shipping': Colchón o subsidio de envío por unidad
	 */
	category?: 'expense' | 'tax' | 'shipping';
}

export interface IProductFinance {
	exchangeRateSnapshot: number; // El valor del dólar al momento de cotizar
	mpCommissionSnapshot: {
		base: number; // Tu baseCommission
		cft3Cuotas: number; // El costo financiero total con IVA 3
		cft6Cuotas: number; // El costo financiero total con IVA 6
	};
	providerCost: {
		inUSD: number;
		inARS: number;
	};
	additionalCosts: ICostConcept[];
	/** Override del método de cálculo por producto ('markup' | 'margin'). Si undefined, usa el global. */
	pricingStrategy: {
		method: PricingMethod;
		targetProfit: number;
	};
	calculatedProfits: {
		transfer: number;
		card_ticket1Pay: number;
		card3Installments: number;
		card6Installments: number;
	};
	maxSafeDiscount?: number;
}

export interface IProductPrices {
	listPrice: number; // El precio máster en el peor escenario (según maxInstallments configurado)
	card_ticket1PayPrice: number; // 🚀 Agregado: Precio para Débito / Crédito 1 pago
	cashTransferPrice: number; // El precio final con descuento por transferencia
	discountPercentageTransfer: number;
	updatedAt?: Date;
	shippingSubsidy?: number; // 🚚 Subsidio logístico individual de esta prenda
	installments: {
		threePaymentsAmount: number;
		sixPaymentsAmount: number;
		hasThreeInstallmentsSeamless: boolean; // 🚀 Agregado: Control para 3 cuotas
		hasSixInstallmentsSeamless: boolean;
	};
}

export interface IProductSeo {
	metaTitle: string;
	metaDescription: string;
	metaImage: {
		url: string;
		public_id: string;
	};
}

// ============ DTOs ============

export interface IProductCreateDTO {
	productType: ProductType;
	provider: string;
	brand: string;
	model: string;
	shortDescription: string;
	largeDescription: string;
	price?: number;
	providerCost?: number;
	useCustomProfit?: boolean;
	customProfitMargin?: number;
	pricingMethodChoice?: PricingMethod;
	additionalCosts?: ICostConcept[] | string;
	discountPercentageTransfer?: number;
	category: string;
	features: string | string[];
	specifications: string | IProductSpec[];
	variants: string | IClothingVariant[] | ITechVariant[] | IVariant[];
	images?: IProductImage[];
	linkProductProvider?: string;
	status?: ProductStatus | string;
	isFeatured?: boolean | string;
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
	sizeGuide?: string | ISizeGuide;
	careInstructions?: string | string[];
	season?: string;
	combineWith?: string[] | string;

	// Beauty-specific (opcionales a nivel DTO)
	volume?: string;
	concentration?: string;
	fragranceFamily?: string;
	scentNotes?: string | { top?: string; heart?: string; base?: string };
	applicationArea?: string;

	// General-specific (opcionales a nivel DTO)
	barcode?: string;
	isSoldByWeight?: boolean;
	unit?: string;
	weight?: string;

	seo?: Partial<IProductSeo>;
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
