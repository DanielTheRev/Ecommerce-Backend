import {
	EcommercePaymentProviders,
	IEcommercePaymentGateway
} from '@/interfaces/ecommerce.interface';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { IProduct, IProductPrices } from '@/interfaces/product.interface';
import UalaApiCheckout from 'ualabis-nodejs';
import { EcommerceService } from './ecommerce.service';
import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { MercadoPagoService } from './mercadopago.service';

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

	async withMercadoPago(
		orderID: string,
		models: TenantModels,
		total: number,
		payerData: { 
			email: string; 
			first_name?: string; 
			last_name?: string; 
			identification?: { type: string; number: string } 
		},
		paymentData: { token?: string; payment_method_id: string; installments: number; type: string; payer?: any },
		tenantSlug: string,
		baseUrl: string
	) {
		try {
			const config = await EcommerceService.getConfig(models);
			const mpConfig = config.paymentGateways.mercadopago;

			if (!mpConfig.active || mpConfig.accessToken === 'no asignado') {
				throw new AppError('MercadoPago is not configured', 'MercadoPago no está configurado para esta tienda', 400);
			}

			// Calcular vencimiento (3 días por defecto para tickets)
			const expirationDate = new Date();
			expirationDate.setDate(expirationDate.getDate() + 3);

			// Construimos el cuerpo para el API de Payments (/v1/payments)
			const mpPaymentBody = {
				transaction_amount: Number(total),
				external_reference: orderID,
				description: this.getDescriptionQuantity(),
				installments: Number(paymentData.installments),
				payment_method_id: paymentData.payment_method_id,
				token: paymentData.token,
				payer: {
					email: paymentData.payer?.email || payerData.email,
					first_name: paymentData.payer?.first_name || payerData.first_name || 'Cliente',
					last_name: paymentData.payer?.last_name || payerData.last_name || 'Ecommerce',
					identification: paymentData.payer?.identification || payerData.identification
				},
				notification_url: baseUrl 
					? `${baseUrl}/api/orders/mercadopago-notification/${tenantSlug}?source_news=webhooks` 
					: ''
			};

			const result = await MercadoPagoService.createPayment(mpConfig.accessToken, mpPaymentBody);

			return { result, error: null };
		} catch (error: any) {
			console.error('Error in withMercadoPago:', error);
			return { result: null, error: error.message || error };
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
		dolar: number,
		models?: TenantModels,
		customProfitMargin?: number
	) {
		try {
			if (paymentProvider === EcommercePaymentProviders.UALA) {
				return await this.calculatePricesWithUala(cost_price, dolar, models, customProfitMargin);
			} else {
				return await this.calculatePricesWithMercadoPago(cost_price, dolar, models, customProfitMargin);
			}
		} catch (error) {
			console.error('Error in CalculatePrices:', error);
			throw new AppError(
				'Failed to calculate prices on PaymentService.CalculatePrices',
				'Error al calcular los precios',
				500
			);
		}
	}

	private static async calculatePricesWithUala(
		cost_price: number,
		dolar: number,
		models?: TenantModels,
		customProfitMargin?: number
	): Promise<IProductPrices> {
		try {
			// * cost_price es el precio de compra del product viene en USD o deberia.
			const config = await EcommerceService.getConfig(models!);
			const ualaConfig = config.paymentGateways.uala;

			// 1. Obtenemos los valores y los normalizamos inmediatamente
			// Si el usuario proveyó un margen custom para este producto, lo usamos. Si no, usamos el global.
			const rawProfit = customProfitMargin !== undefined ? customProfitMargin : config.profit; 
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
				costPrice: {
					inUSD: cost_price,
					inARS: basePriceInArs
				},
				dolarPrice: dolar,
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
					card_6_installments: Math.round(price6Installments - basePriceInArs - ualaTake6),

					// Ticket: Cobrás el precio de tarjeta (o efectivo?), pero Ualá solo descuenta la base. 
					// Usaremos el precio de tarjeta por seguridad.
					ticket: Math.round(price6Installments - basePriceInArs - (price6Installments * baseCommFactor * ivaFactor))
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
	private static async calculatePricesWithMercadoPago(
		cost_price: number,
		dolar: number,
		models?: TenantModels,
		customProfitMargin?: number
	): Promise<IProductPrices> {
		try {
			const config = await EcommerceService.getConfig(models!);
			const mpConfig = config.paymentGateways.mercadopago;

			const rawProfit = customProfitMargin !== undefined ? customProfitMargin : config.profit;
			const rawBaseComm = mpConfig.baseCommission;
			const rawCFT3 = mpConfig.cft3cuotas;
			const rawCFT6 = mpConfig.cft6Cuotas;

			const profitFactor = this.normalizePercentage(rawProfit);
			const baseCommFactor = this.normalizePercentage(rawBaseComm);
			const cft3Factor = this.normalizePercentage(rawCFT3);
			const cft6Factor = this.normalizePercentage(rawCFT6);
			const ivaFactor = 1 + config.taxes.iva / 100;

			const basePriceInArs = cost_price * dolar;
			const targetPrice = basePriceInArs * (1 + profitFactor);

			// MercadoPago suele tener comisiones distintas, pero el esquema de "restar del total" es similar
			const totalTasa6Cuotas = (baseCommFactor + cft6Factor) * ivaFactor;
			const totalTasa3Cuotas = (baseCommFactor + cft3Factor) * ivaFactor;

			const price6Installments = Math.round(targetPrice / (1 - totalTasa6Cuotas));
			const mpTake6 = price6Installments * totalTasa6Cuotas;
			const mpTake3 = price6Installments * totalTasa3Cuotas;

			return {
				costPrice: {
					inUSD: cost_price,
					inARS: basePriceInArs
				},
				dolarPrice: dolar,
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
					cash_transfer: Math.round(targetPrice - basePriceInArs),
					card_3_installments: Math.round(price6Installments - basePriceInArs - mpTake3),
					card_6_installments: Math.round(price6Installments - basePriceInArs - mpTake6),
					ticket: Math.round(price6Installments - basePriceInArs - (price6Installments * baseCommFactor * ivaFactor))
				}
			};
		} catch (error) {
			throw new AppError(
				'Failed to calculate prices with MercadoPago',
				'Error al calcular precios con MercadoPago',
				500
			);
		}
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


	getEarnings(installments: number = 1): number {
		return this.itemsFromCart.reduce((total, item) => {
			const earnings = item.data.prices.earnings;
			let earningPerUnit = 0;

			if (this.isPreferredPaymentType) {
				earningPerUnit = earnings?.cash_transfer || 0;
			} else {
				// Determinamos el tipo de ganancia basado en el tipo de pago actual si está disponible
				if (installments === 0) { // Convención para tickets o pagos únicos
					earningPerUnit = earnings?.ticket || 0;
				} else if (installments <= 3) {
					earningPerUnit = earnings?.card_3_installments || 0;
				} else {
					earningPerUnit = earnings?.card_6_installments || 0;
				}
			}
			return total + (earningPerUnit * item.quantity);
		}, 0);
	}

	private static normalizePercentage(value: number): number {
		if (!value) return 0;
		// Si alguien pone 18 o 10, lo llevamos a 0.18 o 0.10
		// Si alguien ya puso 0.049, lo dejamos como está
		return value >= 1 ? value / 100 : value;
	}
}
