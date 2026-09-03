import { AppError } from '@/errors/app.error';
import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
	if (err instanceof AppError) {
		return res.status(err.statusCode).json({
			success: false,
			message: err.messageToSendClient
		});
	}

	// Manejo amigable de errores de clave duplicada en MongoDB (E11000)
	if ((err as any).code === 11000) {
		const keyPattern = (err as any).keyPattern || {};
		const keyValue = (err as any).keyValue || {};

		if (keyPattern['variants.sku']) {
			const skuVal = keyValue['variants.sku'] || 'ingresado';
			return res.status(400).json({
				success: false,
				message: `El SKU '${skuVal}' ya se encuentra en uso por otro producto. Por favor elegí un SKU único.`
			});
		}

		if (keyPattern.slug) {
			return res.status(400).json({
				success: false,
				message: 'Ya existe un producto con el mismo nombre y marca (slug duplicado).'
			});
		}

		return res.status(400).json({
			success: false,
			message: 'Ya existe un registro con esos datos únicos en la base de datos.'
		});
	}

	// Errors not handled specifically are treated as generic server errors
	console.error('[Unhandled Error]', err);

	return res.status(500).json({
		success: false,
		message: 'Internal Server Error'
	});
}
