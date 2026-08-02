import { AuthRequest } from '@/middleware/auth';
import { NewsletterService } from '@/services/newsletter.service';
import { AppError } from '@/errors/app.error';
import { Response } from 'express';

export class NewsletterController {
	static async subscribe(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const { email } = req.body;
		const result = await NewsletterService.subscribe(models, email);
		res.status(200).json(result);
	}

	static async getAllSubscribers(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		const subscribers = await NewsletterService.getAllSubscribers(models);
		res.status(200).json(subscribers);
	}

	static async deleteSubscriber(req: AuthRequest, res: Response) {
		const models = req.models;
		if (!models) throw new AppError('Tenant Error', 'Modelos no disponibles', 500);

		await NewsletterService.deleteSubscriber(models, req.params.id);
		res.status(200).json({ message: 'Suscriptor eliminado exitosamente' });
	}
}
