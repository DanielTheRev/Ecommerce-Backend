import { Document } from 'mongoose';
import { EmployeePermission } from './permission.interface';

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

export interface IUserCurrentAccount {
	balance: number;
	creditLimit: number;
	isCreditAllowed: boolean;
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
	position?: string;
	permissions?: EmployeePermission[];
	roleProfileId?: string;
	hasPin?: boolean;
	pushTokens?: string[];
	currentAccount?: IUserCurrentAccount;
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
	position?: string;
	permissions?: EmployeePermission[];
	roleProfileId?: string;
	pinCode?: string;
	pushTokens?: string[];
	currentAccount?: IUserCurrentAccount;
	googleID: string;
	profilePhoto: string;
	password?: string;
	isEmailVerified?: boolean;
	rewards?: IUserRewards;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	comparePassword(candidatePassword: string): Promise<boolean>;
	comparePin?(candidatePin: string): Promise<boolean>;
	hasPassword(password: string): Promise<string>;
}
