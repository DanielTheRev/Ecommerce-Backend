import {
	EcommercePaymentProviders,
	IEcommercePaymentGateway
} from '@/interfaces/ecommerce.interface';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { IProduct, IProductPrices } from '@/interfaces/product.interface';
import UalaApiCheckout from 'ualabis-nodejs';
import { EcommerceService } from './ecommerce.service';
import { AppError } from '@/errors/app.error';

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

	static async CalculatePrices(
		paymentProvider: EcommercePaymentProviders,
		cost_price: number,
		dolar: number
	) {
		try {
			//TODO: implementar mas tarde esto↓
			// const paymentGateways = {
			// 	[EcommercePaymentProviders.UALA]: this.calculatePricesWithUala,
			// 	[EcommercePaymentProviders.MERCADOPAGO]: this.calculatePricesWithMercadoPago
			// };
			// const prices = await paymentGateways[paymentGateway](cost_price, dolar);
			const prices = await this.calculatePricesWithUala(cost_price, dolar);
			return prices;
		} catch (error) {
			throw new AppError(
				'Failed to calculate prices on PaymentService.CalculatePrices',
				'Error al calcular los precios',
				500
			);
		}
	}

	private static async calculatePricesWithUala(
		cost_price: number,
		dolar: number
	): Promise<IProductPrices> {
		try {
			const config = await EcommerceService.getConfig();
			const ualaConfig = config.paymentGateways.uala;

			// 1. Obtenemos los valores y los normalizamos inmediatamente
			const rawProfit = config.profit; // Puede ser 10 o 0.1
			const rawBaseComm = ualaConfig.baseCommission; // Puede ser 4.9 o 0.049
			const rawCFT3 = ualaConfig.cft3cuotas; // Puede ser 18.9 o 0.189
			const rawCFT6 = ualaConfig.cft6Cuotas; // Puede ser 18.9 o 0.189

			const profitFactor = this.normalizePercentage(rawProfit);
			const baseCommFactor = this.normalizePercentage(rawBaseComm);
			const cft3Factor = this.normalizePercentage(rawCFT3);
			const cft6Factor = this.normalizePercentage(rawCFT6);
			const ivaFactor = 1 + config.taxes.iva / 100; // El IVA siempre suele ser 21, así que 1.21

			// 2. Costo base
			const basePriceInArs = cost_price * dolar;

			// Si profitFactor es 0.10, la ganancia es base * 0.10
			const targetPrice = basePriceInArs * (1 + profitFactor);

			// 4. Cálculo de la Tasa Total de Ualá con IVA
			// (Comisión Base + CFT) * 1.21
			const totalTasa6Cuotas = (baseCommFactor + cft6Factor) * ivaFactor;
			const totalTasa3Cuotas = (baseCommFactor + cft3Factor) * ivaFactor;

			const price6Installments = Math.round(targetPrice / (1 - totalTasa6Cuotas));

			// 1. Calculamos cuánto nos descuenta Ualá realmente en cada caso
			const ualaTake6 = price6Installments * totalTasa6Cuotas;
			const ualaTake3 = price6Installments * totalTasa3Cuotas; // Usamos price6 porque es tu base de cobro

			return {
				costPrice: cost_price,
				profitMargin: profitFactor,
				baseCommission: baseCommFactor,
				cft6Cuotas: cft6Factor,
				efectivo_transferencia: Math.round(targetPrice),
				tarjeta_credito_debito: price6Installments,
				cuotas: {
					cuotas_3_si: Math.round(price6Installments / 3),
					cuotas_6_si: Math.round(price6Installments / 6)
				},
				earnings: {
					// En efectivo, tu ganancia es simplemente el sobreprecio aplicados
					cash_transfer: Math.round(targetPrice - basePriceInArs),

					// En 3 cuotas: cobrás el precio de 6, pero Ualá te descuenta la tasa de 3
					card_3_installments: Math.round(price6Installments - basePriceInArs - ualaTake3),

					// En 6 cuotas: cobrás el precio de 6 y Ualá te descuenta la tasa de 6 (debería ser igual a tu profit original)
					card_6_installments: Math.round(price6Installments - basePriceInArs - ualaTake6)
				}
			};
		} catch (error) {
			throw new AppError(
				'Failed to calculate prices with Uala on PaymentService.calculatePricesWithUala',
				'Error al calcular precios con Uala',
				500
			);
		}
	}
	// TODO: Implementar cálculo de precios con MercadoPago
	private static calculatePricesWithMercadoPago(cost_price: number) { }

	getOrderProcessedItems() {
		return this.itemsFromCart.map((item) => ({
			product: item.data._id,
			quantity: item.quantity,
			price: this.isPreferredPaymentType
				? item.data.prices.efectivo_transferencia
				: item.data.prices.tarjeta_credito_debito,
			name: item.data.brand + ' ' + item.data.model,

			image: item.data.images[0].url
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


	private static normalizePercentage(value: number): number {
		if (!value) return 0;
		// Si alguien pone 18 o 10, lo llevamos a 0.18 o 0.10
		// Si alguien ya puso 0.049, lo dejamos como está
		return value >= 1 ? value / 100 : value;
	}
}
