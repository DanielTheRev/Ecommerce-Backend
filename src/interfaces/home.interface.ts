import { IProduct } from './product.interface';

export interface IBrandSection {
	brandName: string;
	description: string;
	image: string; // Background image URL
	title: string; // Main banner title
	subtitle: string; // Small top text
	products: IProduct[];

	// Styling configuration
	textClass: string; // 'text-white' or 'text-black'
	buttonClass: string;
	icon: string; // Lucide Icon
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

export interface IHomeConfig {
	offers: IHomeOffer[];
	productByBrand: IBrandSection[];
}


export interface IBanner {
	brandName: string;
	description: string;
	image: string; // Background image URL
	title: string; // Main banner title
	subtitle: string; // Small top text

	// Styling configuration
	textClass: string; // 'text-white' or 'text-black'
	buttonClass: string;
	icon: string; // Lucide Icon name

	// System fields
	isActive: boolean;
	order: number;
}
export interface IBannerDoc extends Document {
	brandName: string;
	description: string;
	image: string; // Background image URL
	title: string; // Main banner title
	subtitle: string; // Small top text

	// Styling configuration
	textClass: string; // 'text-white' or 'text-black'
	buttonClass: string;
	icon: string; // Lucide Icon name

	// System fields
	isActive: boolean;
	order: number;
}


export interface IHeroSlide extends Document {
	title: string;
	imageDesktop: string;
	imageMobile: string;
	link: string;
	altText: string;
	order: number;
	isActive: boolean;
}
