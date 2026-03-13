import { Document } from 'mongoose';

export enum TenantPlan {
	free = 'free',
	basic = 'basic',
	premium = 'premium'
}

export interface ITenant {
	_id: string;
	slug: string;
	name: string;
	dbName: string;
	domain?: string;
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
