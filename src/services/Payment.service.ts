import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { IProduct } from '@/interfaces/product.interface';
import UalaApiCheckout from 'ualabis-nodejs';

export class PaymentService {
	private preferredPaymentTypes = [
		PaymentType.CASH,
		PaymentType.BANK_TRANSFER,
		PaymentType.ALIAS_TRANSFER
	];
	private itemsFromCart: { data: IProduct; quantity: number }[] = [];

	private shippingCost: number = 0;
	private isPreferredPaymentType: boolean = true;

	constructor(items: typeof this.itemsFromCart, paymentType: PaymentType, shippingCost: number) {
		this.itemsFromCart = items;
		this.shippingCost = shippingCost;
		this.isPreferredPaymentType = this.preferredPaymentTypes.includes(paymentType);
	}

	static theOrderIsPreferredPayment(orderType: PaymentType) {
		const preferredPaymentTypes = [
			PaymentType.CASH,
			PaymentType.BANK_TRANSFER,
			PaymentType.ALIAS_TRANSFER
		];
		return preferredPaymentTypes.includes(orderType);
	}

	async withUalaBiss(orderID: string) {
		try {
			const ualaOrder = await UalaApiCheckout.createOrder({
				// amount: 10,
				amount: this.getFinalCost(),
				callbackSuccess: process.env.callbackSuccess + `?id=${orderID}` || '',
				callbackFail: process.env.callbackFail + `?id=${orderID}` || '',
				notificationUrl: `${process.env.notificationUrl}?id=${orderID}`,
				description: this.getDescriptionQuantity()
			});
			return { ualaOrder, error: null };
		} catch (error) {
			console.log(error);
			return { ualaOrder: null, error };
		}
	}

	static async getOrderStatus(orderID: string) {
		try {
			const orderStatus = await UalaApiCheckout.getOrder(orderID);
			return { orderStatus, error: null };
		} catch (error) {
			console.log(error);
			return { orderStatus: null, error };
		}
	}

	getOrderProcessedItems() {
		return this.itemsFromCart.map((item) => ({
			product: item.data._id,
			quantity: item.quantity,
			price: this.isPreferredPaymentType
				? item.data.prices.efectivo_transferencia
				: item.data.prices.tarjeta_credito_debito,
			name: item.data.brand + ' ' + item.data.model,

			image: item.data.image.dark
		}));
	}

	getFinalCost() {
		if (this.isPreferredPaymentType) {
			return this.CalculatePricesWithOutCard() + this.shippingCost;
		}
		return this.CalculatePriceWithCard() + this.shippingCost;
	}

	CalculatePricesWithOutCard() {
		return this.itemsFromCart.reduce(
			(total, item) => total + item.data.prices.efectivo_transferencia * item.quantity,
			0
		);
	}

	CalculatePriceWithCard() {
		return this.itemsFromCart.reduce(
			(total, item) => total + item.data.prices.tarjeta_credito_debito * item.quantity,
			0
		);
	}

	getDescriptionQuantity() {
		return `${this.itemsFromCart.length} ${this.itemsFromCart.length > 1 ? 'productos' : 'producto'}`;
	}
}
