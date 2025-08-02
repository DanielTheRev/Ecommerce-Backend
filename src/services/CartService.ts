import { PaymentType } from '../models/PaymentMethod';
import { IProductDocument } from '../models/Product';

export class CartService {
	static preferredPaymentTypes = [
		PaymentType.CASH,
		PaymentType.BANK_TRANSFER,
		PaymentType.ALIAS_TRANSFER
	];

	static CalculatePricesWithOutCard(items: { data: IProductDocument; quantity: number }[]) {
		return items.reduce(
			(total, item) => total + item.data.prices.efectivo_transferencia * item.quantity,
			0
		);
	}
	static CalculatePriceWithCard(items: { data: IProductDocument; quantity: number }[]) {
		return items.reduce(
			(total, item) => total + item.data.prices.tarjeta_credito_debito * item.quantity,
			0
		);
	}

	static CalculatePricesWithShipping(price: number, cost: number) {
		console.log(`El costo del envio => ${cost}`);
		return price + cost;
	}

	static getDescriptionQuantity(items: { data: IProductDocument; quantity: number }[]) {
		return `${items.length} ${items.length > 1 ? 'productos' : 'producto'}`;
	}
}
