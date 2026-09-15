import { Document } from 'mongoose';

export enum TenantPlan {
	free = 'free',
	basic = 'basic',
	premium = 'premium'
}

export type TenantSubscriptionStatus = 'active' | 'past_due' | 'suspended' | 'trial';
export type TenantBusinessType = 'fashion' | 'kiosk_grocery' | 'gastronomy' | 'tech_electronics' | 'general';

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
