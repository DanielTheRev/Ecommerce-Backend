import { PaymentType } from '@/models/PaymentMethod';
import { IPickupPoint, ShippingType } from '@/models/ShippingOption';
import { ICartItemDTO } from './cart-item';

export interface CreateOrderDTO {
	items: ICartItemDTO[];
	subtotal: number;
	total: number;
	desc: string | number;
	shippingCost: string | number;
	shippingMethod: {
		_id: string;
		type: ShippingType;
		pickupPoint: IPickupPoint;
		cost: number;
	};
	paymentMethod: {
		_id: string;
		type: PaymentType;
	};
}
