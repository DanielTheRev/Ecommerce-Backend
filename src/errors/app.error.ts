export class AppError extends Error {
	public readonly statusCode: number;
	public readonly isOperational: boolean;
	public readonly messageToSendClient: string;

	constructor(
		message: string,
		messageToSendClient: string,
		statusCode: number,
		isOperational = true
	) {
		super(message);
		console.log(message);
		this.statusCode = statusCode;
		this.isOperational = isOperational;
		this.messageToSendClient = messageToSendClient;

		Error.captureStackTrace(this, this.constructor);
	}
}
