import { Document } from 'mongoose';

export enum TenantPlan {
	free = 'free',
	basic = 'basic',
	premium = 'premium'
}

export enum BusinessType {
	KIOSK_GROCERY = 'kiosk_grocery',
	FASHION = 'fashion',
	TECH_ELECTRONICS = 'tech_electronics',
	BUTCHER = 'butcher',
	BAKERY = 'bakery',
	GASTRONOMY = 'gastronomy'
}

export type TenantSubscriptionStatus = 'active' | 'past_due' | 'suspended' | 'trial';
export type TenantBusinessType = BusinessType | 'fashion' | 'kiosk_grocery' | 'gastronomy' | 'tech_electronics' | 'butcher' | 'bakery';

export interface ITenant {
	_id: string;
	slug: string;
	name: string;
	dbName: string;
	businessType?: TenantBusinessType;
	domain?: string;
	apiKey?: string;
	ownerContact?: {
		email: string;
		name?: string;
		phone?: string;
	};
	subscriptionStatus?: TenantSubscriptionStatus;
	isActive: boolean;
	plan: TenantPlan;
	commission: {
		percentage: number;
		fixedFee: number;
	};
	settings: {
		logo?: string;
		primaryColor?: string;
		allowedOrigins: string[];
	};
	createdAt: Date;
	updatedAt: Date;
}
