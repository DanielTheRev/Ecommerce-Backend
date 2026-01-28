import { AppError } from '@/errors/app.error';
import { ShippingOption } from '@/models/ShippingOption.model';

export class ShippingMethodService {
	static getShippingMethodById(id: string) {
		try {
			const shippingMethod = ShippingOption.findById(id).lean();
			if (!shippingMethod)
				throw new AppError(
					'Shipping method not found',
					'No se encontró el método de envío',
					404
				);
			return shippingMethod;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve shipping method',
				'Error al recuperar el método de envío',
				500
			);
		}
	}
}
