import { AppError } from '@/errors/app.error';
import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
	if (err instanceof AppError) {
		console.log(err.message);
		return res.status(err.statusCode).json({
			success: false,
			message: err.messageToSendClient
		});
	}
	// Errors not handled specifically are treated as generic server errors
	console.log(err);

	return res.status(500).json({
		success: false,
		message: 'Internal Server Error'
	});
}
