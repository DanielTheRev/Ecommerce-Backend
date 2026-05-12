import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import {
	EcommercePaymentProviders
} from '@/interfaces/ecommerce.interface';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { IProduct, IProductPrices } from '@/interfaces/product.interface';
import { CreateOrderRequest } from 'mercadopago/dist/clients/order/create/types';
import UalaApiCheckout from 'ualabis-nodejs';
import { EcommerceService } from './ecommerce.service';
import { MercadoPagoService } from './mercadopago.service';
import { Item } from 'mercadopago/dist/clients/order/commonTypes';

export class PaymentService {
	private preferredPaymentTypes = [
		PaymentType.CASH,
		PaymentType.BANK_TRANSFER,
		PaymentType.ALIAS_TRANSFER,
		PaymentType.TICKET
	];
	private itemsFromCart: { data: IProduct; quantity: number }[] = [];

	private shippingCost: number = 0;
	private isPreferredPaymentType: boolean = true;
	private installments: number | null = null;

	constructor(items: typeof this.itemsFromCart, paymentType: PaymentType, shippingCost: number, installments?: number) {
		this.itemsFromCart = items;
		this.shippingCost = shippingCost;
		this.isPreferredPaymentType = this.preferredPaymentTypes.includes(paymentType);
		this.installments = installments ?? null;
	}

	static theOrderIsPreferredPayment(orderType: PaymentType) {
		const preferredPaymentTypes = [
			PaymentType.CASH,
			PaymentType.BANK_TRANSFER,
			PaymentType.ALIAS_TRANSFER,
			PaymentType.TICKET
		];
		return preferredPaymentTypes.includes(orderType);
	}

	// async withUalaBiss(orderID: string) {
	// 	try {
	// 		const ualaOrder = await UalaApiCheckout.createOrder({
	// 			amount: this.getFinalCost(),
	// 			callbackSuccess: process.env.callbackSuccess + `?id=${orderID}` || '',
	// 			callbackFail: process.env.callbackFail + `?id=${orderID}` || '',
	// 			notificationUrl: `${process.env.notificationUrl}?id=${orderID}`,
	// 			description: this.getDescriptionQuantity()
	// 		});
	// 		return { ualaOrder, error: null };
	// 	} catch (error) {
	// 		console.log(error);
	// 		return { ualaOrder: null, error };
	// 	}
	// }

	async withMercadoPago(
		data: {
			orderID: string,
			models: TenantModels,
			total: number,
			payerData: {
				email: string;
				first_name?: string;
				last_name?: string;
				identification?: { type: string; number: string }
			},
			items: Item[],
			mercadoPagoData: { token?: string; payment_method_id: string; installments?: number; type: string; payer?: any },
			tenantSlug: string,
			baseUrl: string
		}
	) {
		try {
			const config = await EcommerceService.getConfig(data.models);
			const mpConfig = config.paymentGateways.mercadopago;

			if (!mpConfig.active || mpConfig.accessToken === 'no asignado') {
				throw new AppError('MercadoPago is not configured', 'MercadoPago no está configurado para esta tienda', 400);
			}

			// Calcular vencimiento (3 días por defecto para tickets)
			const expirationDate = new Date();
			expirationDate.setDate(expirationDate.getDate() + 3);

			console.log('mp Body');
			const mpOrdersBody: CreateOrderRequest = {
				type: 'online',
				capture_mode: 'automatic_async',
				external_reference: data.orderID,
				processing_mode: 'automatic',
				total_amount: data.total.toString(),
				// date_of_expiration: expirationDate.toISOString(),
				payer: {
					email: data.mercadoPagoData.payer?.email || data.payerData.email,
					first_name: data.payerData.first_name || data.mercadoPagoData.payer?.first_name || 'Cliente',
					last_name: data.payerData.last_name || data.mercadoPagoData.payer?.last_name || 'Ecommerce',
					identification: data.mercadoPagoData.payer?.identification || data.payerData.identification
				},
				items: data.items.map(i => ({
					title: i.title,
					quantity: i.quantity,
					unit_price: i.unit_price,
				})),
				transactions: {
					payments: [
						{
							amount: data.total.toString(),
							payment_method: {
								id: data.mercadoPagoData.payment_method_id,
								type: data.mercadoPagoData.type,
								...(data.mercadoPagoData.token && { token: data.mercadoPagoData.token }),
								...(data.mercadoPagoData.type !== 'ticket' && data.mercadoPagoData.installments && { installments: Number(data.mercadoPagoData.installments) }),
							}
						}
					]
				}
			};
			console.log(JSON.stringify(mpOrdersBody));

			const result = await MercadoPagoService.createOrder(mpConfig.accessToken, mpOrdersBody);
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

	getFinalCost() {
		if (this.isPreferredPaymentType) {
			return this.CalculatePricesWithOutCard() + this.shippingCost;
		}
		if (this.installments === 1) {
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
}
