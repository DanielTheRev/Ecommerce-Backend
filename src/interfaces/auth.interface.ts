import { IUser } from "./user.interface";


interface AuthRequest extends Request {
	user?: IUser;
}

export enum AuthProvider {
	GOOGLE = 'google',
	Email = 'email'
}