import { Document } from 'mongoose';

/* User roles */
export enum Role {
	user = 'user',
	admin = 'admin'
}

/* admin interfaces */
export interface IAdminUser extends Document {
	name: string;
	email: string;
	role: Role.admin;
	password: string;
	token: string;
	comparePassword(candidatePassword: string): Promise<boolean>;
	hasPassword(password: string): Promise<string>;
}

export interface IAdminUserCreate {
	name: string;
	email: string;
	password: string;
	token?: string;
}

/* user interfaces */
export interface IUser extends Document {
	name: string;
	email: string;
	role: Role;
	googleID: string;
	profilePhoto: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}
