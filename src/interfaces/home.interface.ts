import { Document, Types } from 'mongoose';
import { IHeroSlide } from './hero.interface';
import { IProduct } from './product.interface';
import { IBentoConfig } from './bento.interface';
import { IShopTheLook } from './shopTheLook.interface';

export interface IHomeConfig {
	offers: IHomeOffer[];
	productByBrand: IBrandSection[];
	heroSlides: IHeroSlide[]
	bentoConfig: IBentoConfig | null;
	shopTheLook: IShopTheLook[];
	news: IProduct[];
	mostSales: IProduct[];
}



export interface IBrandSection {
	name?: string;
	brandName?: string;
	description?: string;
	image: string; // Background / Desktop image URL
	imageMobile?: string;
	title?: string;
	subtitle?: string;
	linkType?: BannerLinkType;
	linkValue?: string;
	showProducts?: boolean;
	products: IProduct[];

	// Styling configuration
	textClass?: string;
	buttonClass?: string;
	icon?: string;
}

export interface IHomeOffer {
	icon: string;
	title: string;
	description: string;
	details: string;
	gradient: string;
	iconBg: string;
	iconColor: string;
}


export type BannerLinkType = 'none' | 'category' | 'collection' | 'brand' | 'product' | 'custom';
export type BannerProductSource = 'category' | 'collection' | 'brand' | 'manual' | 'recent';

export interface IBanner {
	_id: Types.ObjectId;
	name?: string;
	image: string; // Desktop Image URL
	imageMobile?: string; // Mobile Image URL (opcional)
	
	// Redirección al hacer clic
	linkType?: BannerLinkType;
	linkValue?: string;

	// Vitrina de productos vinculados debajo del banner
	showProducts?: boolean;
	productSource?: BannerProductSource;
	productSourceValue?: string;
	manualProductIds?: string[];
	productsCount?: number;

	// Legacy / Styling compatibility fields
	brandName?: string;
	description?: string;
	title?: string;
	subtitle?: string;
	textClass?: string;
	buttonClass?: string;
	icon?: string;

	// System fields
	isActive: boolean;
	order: number;
}

export interface IBannerDoc extends Document, Omit<IBanner, '_id'> {
	_id: Types.ObjectId;
}

