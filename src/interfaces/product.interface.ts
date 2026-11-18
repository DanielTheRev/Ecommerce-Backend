import { Document, Types } from 'mongoose';
import { IClothingVariant, ITechVariant, IVariant, IVariantColor, IVariantAttribute } from './variant.interface';
import { IProvider } from './provider.interface';
import { PricingMethod } from './ecommerce.interface';

// ============ ENUMS ============

export enum ProductType {
	TECH = 'TechProduct',
	CLOTHING = 'ClothingProduct',
	BEAUTY = 'BeautyProduct',
	KIOSK = 'KioskProduct'
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

export type WeighableUnit = 'kg' | 'g' | 'docena' | 'un' | 'l' | 'ml';
export type ImageAspectRatio = 'original' | '1:1' | '9:16' | '4:5' | '16:9';

// ============ SUB-INTERFACES ============

export interface IProductDescriptions {
	subtitle?: string;
	shortDescription?: string;
	largeDescription?: string;
}

export interface IProductViewEvent {
	viewedAt: Date;
	device: 'mobile' | 'desktop' | 'tablet' | 'bot';
	browser?: string;
	os?: string;
	url?: string;
	referrer?: string;
	ip?: string;
	isBot: boolean;
	botName?: string;
	userAgent?: string;
	rejectionReason?: string;
	manuallyApproved?: boolean;
}

export interface IProductMetrics {
	viewsCount: number;
	botViewsCount?: number;
	cartAddsCount: number;
	salesCount: number;
	viewsByDevice?: {
		mobile: number;
		desktop: number;
		tablet: number;
		bot: number;
	};
	recentViews?: IProductViewEvent[];
	lastViewedAt?: Date;
}

export interface IProductImageCrop {
	aspectRatio: ImageAspectRatio;
	url: string;
	public_id?: string;
	storageKey?: string;
	width?: number;
	height?: number;
	bytes?: number;
	format?: string;
}

export interface IProductImage {
	/** Identificador lógico estable de Vexx (agnóstico de Cloudinary/storage) */
	id?: string;
	url: string;
	public_id: string;
	storageProvider?: string;
	storageKey?: string;
	width?: number;
	height?: number;
	bytes?: number;
	format?: string;
	/** SKUs de variantes vinculadas a esta foto (modo Tusty multi-foto) */
	variantSkus?: string[];
	/** Recortes multi-aspecto generados por Media Studio */
	crops?: IProductImageCrop[];
	// [REMOVE-BEFORE-PROD]: legacy singular tagging fields
	variantSku?: string;
	colorName?: string;
	isMain?: boolean;
	aspectRatio?: ImageAspectRatio;
}

export interface IProductSpec {
	key: string;
	value: string;
	isFeatured?: boolean;
}

export interface ISizeGuideRow {
	size: string;
	values: string[];
}

export interface ISizeGuide {
	headers: string[];
	rows: ISizeGuideRow[];
	tolerance?: string;
}

export interface ICombineWithItem {
	product: string | IProduct;
	variantSku?: string | null;
	color?: string | null;
}

export interface ICostConcept {
	concept: string;
	value: number;
	type: 'fixed' | 'percent_over_provider' | 'percent_over_price';
	category?: 'expense' | 'tax' | 'shipping';
}

export type PricingChannelKey = 'cash' | 'transfer' | 'qr' | 'debit' | 'credit1Pay' | 'list';
export type ChannelPriceMode = 'auto' | 'linked' | 'discount_from_list' | 'fixed';

export interface IChannelPricingRule {
	enabled?: boolean;
	mode: ChannelPriceMode;
	linkedTo?: PricingChannelKey;
	discountPercent?: number;
	fixedPrice?: number;
	inheritCosts?: boolean;
	excludedCostConcepts?: string[];
	extraCosts?: ICostConcept[];
}

export type IChannelPricingConfig = Partial<Record<PricingChannelKey, IChannelPricingRule>>;

export interface IPricingInsight {
	type: 'info' | 'warning' | 'success';
	code: string;
	message: string;
}

export interface IChannelPriceSnapshot {
	enabled?: boolean;
	price: number;
	mode: ChannelPriceMode;
	linkedTo?: PricingChannelKey;
	discountPercent?: number;
	netProfit: number;
	netMarginPercent: number;
	feeLabel?: string;
	costBaseARS?: number;
	isWarningLoss: boolean;
	isBelowTargetMargin?: boolean;
}

export interface IProductFinance {
	exchangeRateSnapshot: number;
	mpCommissionSnapshot: {
		base: number;
		cft3Cuotas: number;
		cft6Cuotas: number;
	};
	providerCost: {
		inUSD: number;
		inARS: number;
	};
	additionalCosts: ICostConcept[];
	pricingStrategy: {
		method: PricingMethod;
		targetProfit: number;
	};
	calculatedProfits: {
		cash?: number;
		transfer: number;
		qr?: number;
		debit?: number;
		card_ticket1Pay: number;
		card3Installments: number;
		card6Installments: number;
	};
	maxSafeDiscount?: number;
}

export interface IProductPrices {
	listPrice: number;
	card_ticket1PayPrice: number;
	cashTransferPrice: number;
	cashPrice?: number;
	transferPrice?: number;
	qrPrice?: number;
	debitPrice?: number;
	discountPercentageTransfer: number;
	channels?: Partial<Record<PricingChannelKey, IChannelPriceSnapshot>>;
	displaySummary?: Array<{
		label: string;
		price: number;
		channels: PricingChannelKey[];
		surface?: 'all' | 'web' | 'pos';
	}>;
	updatedAt?: Date;
	shippingSubsidy?: number;
	installments: {
		threePaymentsAmount: number;
		sixPaymentsAmount: number;
		hasThreeInstallmentsSeamless: boolean;
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

// ============ INTERFAZ PRINCIPAL DE PRODUCTO ============

export interface IProduct {
	_id: string;
	name: string;
	brand?: string;
	model?: string;
	slug: string;
	category: string;
	shortDescription: string;
	largeDescription: string;
	subtitle?: string;
	descriptions?: IProductDescriptions;
	price: IProductPrices;
	finance: IProductFinance;
	discount: number;
	netStock: number;
	lowStockThreshold?: number;
	status: ProductStatus;
	isFeatured: boolean;
	images: IProductImage[];
	specifications?: IProductSpec[];
	variants: IVariant[];
	tags?: string[];
	features?: string[];
	barcode?: string;
	isSoldByWeight?: boolean;
	unit?: WeighableUnit;
	weight?: string;
	rankingScore?: number;
	effectiveScore?: number;
	metrics?: IProductMetrics;
	provider?: IProvider | string;
	linkProductProvider?: string;
	seo?: IProductSeo;
	channelPricing?: IChannelPricingConfig;
	paymentRestrictions?: {
		allowCardPayment: boolean;
		allowInterestFreeInstallments: boolean;
		maxInstallments?: number;
	};
	recommendationsMode?: 'auto' | 'manual';
	manualRecommendations?: (string | IProduct)[];
	productType?: ProductType;
	rating?: number | null;
	reviews?: number | null;

	// Extensiones Modulares por Rubro (Directas en la entidad unificada)
	// Moda & Calzado:
	gender?: ClothingGender;
	fit?: string;
	material?: string;
	composition?: { material: string; percentage: number }[];
	sizeType?: ClothingSizeType;
	sizeGuide?: ISizeGuide;
	careInstructions?: string[];
	season?: string;
	combineWith?: (string | IProduct | ICombineWithItem)[];

	// Tecnología:
	storage?: string[];
	ram?: string;
	processor?: string;
	screenSize?: string;
	os?: string;
	connectivity?: string[];

	// Perfumería & Belleza:
	volume?: string;
	concentration?: string;
	fragranceFamily?: string;
	scentNotes?: {
		top?: string;
		heart?: string;
		base?: string;
	};
	applicationArea?: string;
}

// Alias de retrocompatibilidad de tipos para código legado existente
export type IClothingProduct = IProduct;
export type ITechProduct = IProduct;
export type IBeautyProduct = IProduct;
export type IKioskProduct = IProduct;

// ============ DTOs ============

export interface IProductCreateDTO {
	name?: string;
	productType?: ProductType;
	provider?: string;
	brand: string;
	model: string;
	shortDescription?: string;
	largeDescription?: string;
	subtitle?: string;
	descriptions?: IProductDescriptions;
	price?: number;
	providerCost?: number;
	useCustomProfit?: boolean;
	customProfitMargin?: number;
	pricingMethodChoice?: PricingMethod;
	channelPricing?: IChannelPricingConfig | string;
	paymentRestrictions?: {
		allowCardPayment: boolean;
		allowInterestFreeInstallments: boolean;
		maxInstallments?: number;
	} | string;
	additionalCosts?: ICostConcept[] | string;
	discountPercentageTransfer?: number;
	category: string;
	features?: string | string[];
	specifications?: string | IProductSpec[];
	variants?: string | IClothingVariant[] | ITechVariant[] | IVariant[];
	images?: IProductImage[];
	masterImageUrl?: string;
	linkProductProvider?: string;
	status?: ProductStatus | string;
	isFeatured?: boolean | string;
	rankingScore?: number;
	tags?: string | string[];
	netStock?: number;
	lowStockThreshold?: number;

	// Balanza y Mostrador
	barcode?: string;
	isSoldByWeight?: boolean;
	unit?: WeighableUnit;
	weight?: string;

	// Tech
	storage?: string | string[];
	ram?: string;
	processor?: string;
	screenSize?: string;
	os?: string;
	connectivity?: string | string[];

	// Moda
	gender?: string;
	fit?: string;
	material?: string;
	composition?: string | { material: string; percentage: number }[];
	sizeType?: string;
	sizeGuide?: string | ISizeGuide;
	careInstructions?: string | string[];
	season?: string;
	combineWith?: (string | ICombineWithItem)[] | string;

	// Belleza
	volume?: string;
	concentration?: string;
	fragranceFamily?: string;
	scentNotes?: string | { top?: string; heart?: string; base?: string };
	applicationArea?: string;

	seo?: Partial<IProductSeo>;
}

export interface IProductUpdateDTO extends Partial<IProductCreateDTO> {
	_id?: string;
	deletedImages?: string[];
	deletedSeoOgImage?: string;
	images?: IProductImage[];
	slug?: string;
	prices?: number | IProductPrices;
	rankingScore?: number;
	metrics?: IProductMetrics;
	effectiveScore?: number;
}

// ============ DOCUMENT ============

export interface IProductDocument extends Omit<Document, 'model'>, Omit<IProduct, 'model' | '_id'> {
	_id: Types.ObjectId;
	model?: string;
}
