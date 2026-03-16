import { Document } from 'mongoose';

/* User roles */
export enum Role {
	user = 'user',
	admin = 'admin',
	employee = 'employee'
}

export interface ISecureUser {
	_id: string;
	name: string;
	email: string;
	role: Role;
	googleID: string;
	profilePhoto: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

/* user interfaces */
export interface IUser {
	_id: string;
	name: string;
	email: string;
	role: Role;
	googleID: string;
	profilePhoto: string;
	password: string;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	comparePassword(candidatePassword: string): Promise<boolean>;
	hasPassword(password: string): Promise<string>;
}
