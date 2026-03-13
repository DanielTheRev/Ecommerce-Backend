import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodObject } from 'zod';

export const validateSchema = (schema: ZodObject) => (req: Request, res: Response, next: NextFunction) => {
	try {

		console.log(req.body);
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
