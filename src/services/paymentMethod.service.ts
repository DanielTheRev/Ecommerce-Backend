import { AppError } from '@/errors/app.error';
import { PaymentMethod } from '@/models/PaymentMethod.model';

export class PaymentMethodService {
	static async getPaymentMethodById(id: string) {
		try {
			const paymentMethod = await PaymentMethod.findById(id).lean();
			if (!paymentMethod) throw new AppError('Payment method not found', 404);
			return paymentMethod;
		} catch (error) {
			throw new AppError('Failed to retrieve payment method', 500);
		}
	}
}
