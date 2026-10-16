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
			mercadoPagoData: { token?: string; payment_method_id?: string; installments?: number; type?: string; payer?: any; checkoutMode?: string },
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

			const hasToken = Boolean(data.mercadoPagoData?.token);
			const isTicket = data.mercadoPagoData?.type === 'ticket';

			const isCheckoutPro =
				!hasToken &&
				!isTicket &&
				(
					mpConfig.checkoutMode === 'pro' ||
					mpConfig.checkoutMode === 'hybrid' ||
					data.mercadoPagoData?.type === 'checkout_pro' ||
					data.mercadoPagoData?.checkoutMode === 'pro' ||
					true
				);

			if (isCheckoutPro) {
				const clientOrigin =
					(mpConfig as any).successUrl
						? new URL((mpConfig as any).successUrl).origin
						: config.callbackURLs?.success
						? new URL(config.callbackURLs.success).origin
						: (data.baseUrl?.includes('localhost') ? 'http://localhost:4200' : (data.baseUrl || 'https://vura.com.ar'));

				const resolveBackUrl = (rawUrl?: string, defaultUrl?: string): string => {
					let url = rawUrl?.trim();
					if (!url) return defaultUrl || '';
					if (url.startsWith('/')) {
						url = `${clientOrigin}${url}`;
					}
					url = url.replace(/:id\b|:orderId\b|\{id\}|\{orderId\}/gi, data.orderID);
					if (url.includes('order-confirmed') && !url.includes(data.orderID)) {
						try {
							const parsed = new URL(url);
							parsed.pathname = parsed.pathname.endsWith('/')
								? `${parsed.pathname}${data.orderID}`
								: `${parsed.pathname}/${data.orderID}`;
							url = parsed.toString();
						} catch {
							url = url.endsWith('/') ? `${url}${data.orderID}` : `${url}/${data.orderID}`;
						}
					}
					return url;
				};

				const defaultSuccess = `${clientOrigin}/order-confirmed/${data.orderID}?payment=success`;
				const defaultFailure = `${clientOrigin}/checkout?error=payment_failed&orderId=${data.orderID}`;
				const defaultPending = `${clientOrigin}/order-confirmed/${data.orderID}?payment=pending`;

				const successUrl = resolveBackUrl((mpConfig as any).successUrl || config.callbackURLs?.success, defaultSuccess);
				const failureUrl = resolveBackUrl((mpConfig as any).failureUrl || config.callbackURLs?.fail, defaultFailure);
				const pendingUrl = resolveBackUrl((mpConfig as any).pendingUrl, defaultPending);

				// Formatear ítems asegurando consistencia con total_amount requerido por MP
				const mpItemsFormatted = data.items.map(i => {
					const unitPriceNum = Math.round(Number(i.unit_price) * 100) / 100;
					const qty = Math.max(1, i.quantity || 1);
					return {
						title: i.title || 'Producto',
						quantity: qty,
						unit_price: unitPriceNum.toFixed(2),
						...(i.picture_url && { picture_url: i.picture_url })
					};
				});

				// Chequeo de cuadratura exacta entre sum(unit_price * quantity) y total_amount
				const sumItems = mpItemsFormatted.reduce((acc, curr) => acc + (Number(curr.unit_price) * curr.quantity), 0);
				const totalNum = Math.round(data.total * 100) / 100;
				if (Math.abs(sumItems - totalNum) > 0.01 && mpItemsFormatted.length > 0) {
					const diff = Math.round((totalNum - sumItems) * 100) / 100;
					const lastItem = mpItemsFormatted[mpItemsFormatted.length - 1];
					const newLastUnit = Number(lastItem.unit_price) + (diff / lastItem.quantity);
					lastItem.unit_price = newLastUnit.toFixed(2);
				}

				const mpOrdersBody: any = {
					type: 'online',
					processing_mode: 'manual',
					capture_mode: 'automatic_async',
					total_amount: totalNum.toFixed(2),
					external_reference: data.orderID,
					payer: {
						email: data.mercadoPagoData?.payer?.email || data.payerData.email,
						first_name: data.payerData.first_name || data.mercadoPagoData?.payer?.first_name || 'Cliente',
						last_name: data.payerData.last_name || data.mercadoPagoData?.payer?.last_name || 'Ecommerce',
						...((data.mercadoPagoData?.payer?.identification || data.payerData.identification) && {
							identification: data.mercadoPagoData?.payer?.identification || data.payerData.identification
						})
					},
					items: mpItemsFormatted,
					config: {
						online: {
							success_url: successUrl,
							failure_url: failureUrl,
							pending_url: pendingUrl
						}
					}
				};

				console.log('📦 Creando orden Checkout Pro en Mercado Pago:', JSON.stringify(mpOrdersBody));
				const result = await MercadoPagoService.createOrder(mpConfig.accessToken, mpOrdersBody);
				console.log('✅ Orden Checkout Pro creada con éxito en Mercado Pago:', JSON.stringify(result));
				return { result, error: null };
			}

			// Flujo Checkout Bricks / Transparente (con tarjeta tokenizada)
			const mpOrdersBody: CreateOrderRequest = {
				type: 'online',
				capture_mode: 'automatic_async',
				external_reference: data.orderID,
				processing_mode: 'automatic',
				total_amount: data.total.toString(),
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
								id: data.mercadoPagoData.payment_method_id!,
								type: data.mercadoPagoData.type!,
								...(data.mercadoPagoData.token && { token: data.mercadoPagoData.token }),
								...(data.mercadoPagoData.type !== 'ticket' && data.mercadoPagoData.installments && { installments: Number(data.mercadoPagoData.installments) }),
							}
						}
					]
				}
			};

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
			return this.CalculatePricesWithTransfer() + this.shippingCost;
		}
		if (this.installments === 1) {
			return this.CalculatePricesWithCard1Pay() + this.shippingCost;
		}
		return this.CalculatePriceWithCardList() + this.shippingCost;
	}

	CalculatePricesWithTransfer() {
		return this.itemsFromCart.reduce(
			(total, item) => total + (item.data.price?.cashTransferPrice || 0) * item.quantity,
			0
		);
	}

	CalculatePricesWithCard1Pay() {
		return this.itemsFromCart.reduce(
			(total, item) => total + (item.data.price?.card_ticket1PayPrice || 0) * item.quantity,
			0
		);
	}

	CalculatePriceWithCardList() {
		return this.itemsFromCart.reduce(
			(total, item) => total + (item.data.price?.listPrice || 0) * item.quantity,
			0
		);
	}

	CalculatePricesWithOutCard() {
		// Mantener para retrocompatibilidad
		return this.CalculatePricesWithTransfer();
	}

	CalculatePriceWithCard() {
		// Mantener para retrocompatibilidad
		return this.CalculatePriceWithCardList();
	}

	getDescriptionQuantity() {
		return `${this.itemsFromCart.length} ${this.itemsFromCart.length > 1 ? 'productos' : 'producto'}`;
	}


	getEarnings(installments: number = 1): number {
		return this.itemsFromCart.reduce((total, item) => {
			const calculatedProfits = item.data.finance?.calculatedProfits;
			let earningPerUnit = 0;

			if (this.isPreferredPaymentType) {
				earningPerUnit = calculatedProfits?.transfer || 0;
			} else {
				if (installments === 1) {
					earningPerUnit = calculatedProfits?.card_ticket1Pay || 0;
				} else if (installments <= 3) {
					earningPerUnit = calculatedProfits?.card3Installments || 0;
				} else {
					earningPerUnit = calculatedProfits?.card6Installments || 0;
				}
			}
			return total + (earningPerUnit * item.quantity);
		}, 0);
	}
}
