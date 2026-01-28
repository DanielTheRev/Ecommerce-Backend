import { AppError } from './app.error';

export class AuthError extends AppError {
	constructor(message = 'Unauthorized', messageToSend: string, statusCode = 401) {
		super(message, messageToSend, statusCode);
	}
}
