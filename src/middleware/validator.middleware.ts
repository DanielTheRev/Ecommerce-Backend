import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

export const validateSchema = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
	console.log(req.body, req.query);
	try {
		schema.parse({
			body: req.body,
			query: req.query,
			params: req.params
		});
		return next();
	} catch (error) {
		console.log(error);
		if (error instanceof ZodError) {
			return res.status(400).json({
				success: false,
				message: 'Validation failed',
			});
		}
		return next(error);
	}
};
