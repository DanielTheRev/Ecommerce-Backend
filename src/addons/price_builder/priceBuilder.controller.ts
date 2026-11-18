import { NextFunction, Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { PriceBuilderService } from './priceBuilder.service';
import { calculatePreviewSchema } from './priceBuilder.validators';

export class PriceBuilderController {
	static async getPresets(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			res.status(200).json({
				success: true,
				data: PriceBuilderService.getPresetsAndRates()
			});
		} catch (error) {
			next(error);
		}
	}

	static async calculatePreview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const parsed = calculatePreviewSchema.parse(req.body || {});
			const result = await PriceBuilderService.calculatePreview(req.models!, {
				...parsed,
				providerCost: parsed.providerCost ?? parsed.costPrice ?? 0
			});
			res.status(200).json({
				success: true,
				...result
			});
		} catch (error) {
			next(error);
		}
	}
}
