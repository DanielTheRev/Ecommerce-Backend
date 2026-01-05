import { AppError } from './app.error';

export class AuthError extends AppError {
	constructor(message = 'Unauthorized', statusCode = 401) {
		super(message, statusCode);
	}
}
