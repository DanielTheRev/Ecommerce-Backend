import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';

export class NewsletterService {
	static async subscribe(models: TenantModels, email: string) {
		if (!email || !email.includes('@')) {
			throw new AppError('Invalid email', 'Por favor ingresá un e-mail válido', 400);
		}

		const cleanEmail = email.trim().toLowerCase();

		let subscriber = await models.Newsletter.findOne({ email: cleanEmail });
		if (subscriber) {
			if (!subscriber.isActive) {
				subscriber.isActive = true;
				await subscriber.save();
			}
		} else {
			subscriber = await models.Newsletter.create({ email: cleanEmail });
		}

		// Sincronizar con el usuario en MongoDB si existe la cuenta
		const user = await models.User.findOne({ email: cleanEmail });
		if (user) {
			if (!user.rewards) {
				user.rewards = {
					newsletterSubscribed: true,
					newsletterSubscribedAt: new Date(),
					firstPurchaseEligible: true,
					instagramClaimed: false
				};
			} else {
				user.rewards.newsletterSubscribed = true;
				user.rewards.newsletterSubscribedAt = new Date();
			}
			await user.save();
		}

		return { message: '¡Suscripción exitosa! Bienvenido al Club Vura.', subscriber, user };
	}

	static async getAllSubscribers(models: TenantModels) {
		const subscribers = await models.Newsletter.find().sort({ createdAt: -1 }).lean();
		return subscribers;
	}

	static async deleteSubscriber(models: TenantModels, id: string) {
		const result = await models.Newsletter.findByIdAndDelete(id);
		if (!result) throw new AppError('Not found', 'Suscriptor no encontrado', 404);
	}
}
