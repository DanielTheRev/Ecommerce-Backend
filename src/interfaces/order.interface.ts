import { IPaymentMethod } from '@/models/PaymentMethod';
import { IShippingOption, IPickupPoint } from '@/models/ShippingOption';

export interface CreateOrderDTO {
	items: {
		productId: string;
		name: string;
		price: number;
		quantity: number;
		image: string;
	}[];
	total: number;
	shippingMethod: {
		type: IShippingOption;
		pickupPoint: IPickupPoint;
	};
	paymentMethod: IPaymentMethod;
}
