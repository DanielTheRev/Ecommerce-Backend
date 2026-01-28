import { IUser, Role } from './user.interface';

interface AuthRequest extends Request {
	user?: IUser;
}

export enum AuthProvider {
	GOOGLE = 'google',
	Email = 'email'
}

export interface ILoginUserWithGoogle {
	provider: AuthProvider;
	token: string;
	email: string;
	password: string;
}
