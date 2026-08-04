import { Document } from 'mongoose';

/* User roles */
export enum Role {
	user = 'user',
	admin = 'admin',
	employee = 'employee'
}

export interface IUserRewards {
	firstPurchaseEligible: boolean;
	firstPurchaseUsed?: boolean;
	newsletterSubscribed: boolean;
	newsletterSubscribedAt?: Date | null;
	newsletterUsed?: boolean;
	instagramClaimed: boolean;
	instagramUsed?: boolean;
}

export interface ISecureUser {
	_id: string;
	name: string;
	lastName?: string;
	dni?: string;
	phone?: string;
	email: string;
	role: Role;
	googleID: string;
	profilePhoto: string;
	isEmailVerified?: boolean;
	rewards?: IUserRewards;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/* user interfaces */
export interface IUser {
	_id: string;
	name: string;
	lastName?: string;
	dni?: string;
	phone?: string;
	email: string;
	role: Role;
	googleID: string;
	profilePhoto: string;
	password?: string;
	isEmailVerified?: boolean;
	rewards?: IUserRewards;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	comparePassword(candidatePassword: string): Promise<boolean>;
	hasPassword(password: string): Promise<string>;
}
