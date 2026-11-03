import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

export const validateSchema = (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
	try {
		schema.parse({
			body: req.body,
			query: req.query,
			params: req.params,
		});
		return next();
	} catch (error) {
		if (error instanceof ZodError) {
			const formattedIssues = error.issues.map((issue) => ({
				field: issue.path.join('.').replace(/^(body|query|params)\./, ''),
				message: issue.message,
			}));
			const firstMessage = formattedIssues[0]?.message || 'Datos de validación inválidos';

			return res.status(400).json({
				success: false,
				message: firstMessage,
				errors: formattedIssues,
			});
		}
		return next(error);
	}
};
