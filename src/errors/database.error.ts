import { AppError } from './app.error';

export class DatabaseError extends AppError {
	constructor(message = 'Database Error', statusCode = 500) {
		super(message, statusCode);
	}
}
