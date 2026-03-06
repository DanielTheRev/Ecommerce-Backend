import { AppError } from './app.error';

export class DatabaseError extends AppError {
	constructor(message = 'Database Error', userMessage = 'Error de base de datos', statusCode = 500) {
		super(message, userMessage, statusCode);
	}
}
