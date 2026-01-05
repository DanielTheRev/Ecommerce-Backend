import { AppError } from '@/errors/app.error';
import { ShippingOption } from '@/models/ShippingOption.model';

export class ShippingMethodService {
	static getShippingMethodById(id: string) {
		try {
			const shippingMethod = ShippingOption.findById(id).lean();
			if (!shippingMethod) throw new AppError('Shipping method not found', 404);
			return shippingMethod;
		} catch (error) {
			throw new AppError('Failed to retrieve shipping method', 500);
		}
	}
}
