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

	static async CalculatePrices(
		data: {
			paymentProvider: EcommercePaymentProviders,
			cost_price: number,
			dolar: number,
			models?: TenantModels,
			customProfitMargin?: number,
			customProfitMargin1Pay?: number,
			customProfitMarginInstallments?: number
		}
	) {
		try {
			// if (paymentProvider === EcommercePaymentProviders.UALA) {
			// return await this.calculatePricesWithUala(cost_price, dolar, models, customProfitMargin);
			// } else {
			return await this.calculatePricesWithMercadoPago(data);
			// }
		} catch (error) {
			console.error('Error in CalculatePrices:', error);
			throw new AppError(
				'Failed to calculate prices on PaymentService.CalculatePrices',
				'Error al calcular los precios',
				500
			);
		}
	}

	// private static async calculatePricesWithUala(
	// 	cost_price: number,
	// 	dolar: number,
	// 	models?: TenantModels,
	// 	customProfitMargin?: number
	// ): Promise<IProductPrices> {
	// 	try {
	// 		// * cost_price es el precio de compra del product viene en USD o deberia.
	// 		const config = await EcommerceService.getConfig(models!);
	// 		const ualaConfig = config.paymentGateways.uala;

	// 		// 1. Obtenemos los valores y los normalizamos inmediatamente
	// 		// Si el usuario proveyó un margen custom para este producto, lo usamos. Si no, usamos el global.
	// 		const rawProfit = customProfitMargin !== undefined ? customProfitMargin : config.profit;
	// 		const rawBaseComm = ualaConfig.baseCommission; // Puede ser 4.9 o 0.049
	// 		const rawCFT3 = ualaConfig.cft3cuotas; // Puede ser 18.9 o 0.189
	// 		const rawCFT6 = ualaConfig.cft6Cuotas; // Puede ser 18.9 o 0.189

	// 		const profitFactor = this.normalizePercentage(rawProfit);
	// 		const baseCommFactor = this.normalizePercentage(rawBaseComm);
	// 		const cft3Factor = this.normalizePercentage(rawCFT3);
	// 		const cft6Factor = this.normalizePercentage(rawCFT6);
	// 		const ivaFactor = 1 + config.taxes.iva / 100; // El IVA siempre suele ser 21, así que 1.21

	// 		// 2. Costo base
	// 		const basePriceInArs = cost_price * dolar;

	// 		// Si profitFactor es 0.10, la ganancia es base * 0.10
	// 		const targetPrice = basePriceInArs * (1 + profitFactor);

	// 		// 4. Cálculo de la Tasa Total de Ualá con IVA
	// 		// (Comisión Base + CFT) * 1.21
	// 		const totalTasa6Cuotas = (baseCommFactor + cft6Factor) * ivaFactor;
	// 		const totalTasa3Cuotas = (baseCommFactor + cft3Factor) * ivaFactor;

	// 		const price6Installments = Math.round(targetPrice / (1 - totalTasa6Cuotas));

	// 		// 1. Calculamos cuánto nos descuenta Ualá realmente en cada caso
	// 		const ualaTake6 = price6Installments * totalTasa6Cuotas;
	// 		const ualaTake3 = price6Installments * totalTasa3Cuotas; // Usamos price6 porque es tu base de cobro

	// 		return {
	// 			costPrice: {
	// 				inUSD: cost_price,
	// 				inARS: basePriceInArs
	// 			},
	// 			dolarPrice: dolar,
	// 			profitMargin: profitFactor,
	// 			baseCommission: baseCommFactor,
	// 			cft6Cuotas: cft6Factor,
	// 			efectivo_transferencia: Math.round(targetPrice),
	// 			tarjeta_credito_debito: price6Installments,
	// 			cuotas: {
	// 				cuotas_3_si: Math.round(price6Installments / 3),
	// 				cuotas_6_si: Math.round(price6Installments / 6)
	// 			},
	// 			earnings: {
	// 				// En efectivo, tu ganancia es simplemente el sobreprecio aplicados
	// 				cash_transfer: Math.round(targetPrice - basePriceInArs),

	// 				// En 3 cuotas: cobrás el precio de 6, pero Ualá te descuenta la tasa de 3
	// 				card_3_installments: Math.round(price6Installments - basePriceInArs - ualaTake3),

	// 				// En 6 cuotas: cobrás el precio de 6 y Ualá te descuenta la tasa de 6 (debería ser igual a tu profit original)
	// 				card_6_installments: Math.round(price6Installments - basePriceInArs - ualaTake6),

	// 				// Ticket: Cobrás el precio de tarjeta (o efectivo?), pero Ualá solo descuenta la base. 
	// 				// Usaremos el precio de tarjeta por seguridad.
	// 				ticket: Math.round(price6Installments - basePriceInArs - (price6Installments * baseCommFactor * ivaFactor))
	// 			}
	// 		};
	// 	} catch (error) {
	// 		throw new AppError(
	// 			'Failed to calculate prices with Uala on PaymentService.calculatePricesWithUala',
	// 			'Error al calcular precios con Uala',
	// 			500
	// 		);
	// 	}
	// }


	private static async calculatePricesWithMercadoPago(
		data: {
			cost_price: number,
			dolar: number,
			models?: TenantModels,
			customProfitMargin?: number, // Margen general (por si se usa un solo input)
			customProfitMargin1Pay?: number, // Margen gordo para Efectivo/Transf (Ej: 100%)
			customProfitMarginInstallments?: number // Margen achato para Cuotas (Ej: 40%)
		}
	): Promise<IProductPrices> {
		try {
			const { cost_price, dolar, models, customProfitMargin, customProfitMargin1Pay, customProfitMarginInstallments } = data;
			const config = await EcommerceService.getConfig(models!);
			const mpConfig = config.paymentGateways.mercadopago;

			// =========================================================
			// PASO 1: DEFINIR QUÉ GANANCIA USAR (El fallback)
			// Si mandaste un profit específico, usa ese. Si no, usa el general. 
			// Si no hay general, usa el de la configuración de la tienda.
			// =========================================================
			const rawProfit1Pay = customProfitMargin1Pay ?? customProfitMargin ?? config.profit;
			const rawProfitInstallments = customProfitMarginInstallments ?? customProfitMargin1Pay ?? config.profit;

			const rawBaseComm = mpConfig.baseCommission;
			const rawCFT3 = mpConfig.cft3cuotas;
			const rawCFT6 = mpConfig.cft6Cuotas;

			// Normalizamos todo a decimales (ej: 40% -> 0.40)
			const profitFactor1Pay = this.normalizePercentage(rawProfit1Pay);
			const profitFactorInstallments = this.normalizePercentage(rawProfitInstallments);
			const baseCommFactor = this.normalizePercentage(rawBaseComm);
			const cft3Factor = this.normalizePercentage(rawCFT3);
			const cft6Factor = this.normalizePercentage(rawCFT6);
			const ivaFactor = 1 + config.taxes.iva / 100;

			// =========================================================
			// PASO 2: NUESTRO COSTO BASE Y LO QUE QUEREMOS EN MANO
			// =========================================================
			const basePriceInArs = cost_price * dolar; // Costo puro

			// Acá está la magia: Calculamos dos bolsillos distintos
			const targetPrice1Pay = basePriceInArs * (1 + profitFactor1Pay);
			const targetPriceInstallments = basePriceInArs * (1 + profitFactorInstallments);

			// =========================================================
			// PASO 3: LAS COMISIONES TOTALES DE MERCADO PAGO
			// =========================================================
			const cft1Factor = baseCommFactor * ivaFactor; // Débito, Crédito 1 Pago, Dinero MP
			const totalTasa3Cuotas = (baseCommFactor + cft3Factor) * ivaFactor;
			const totalTasa6Cuotas = (baseCommFactor + cft6Factor) * ivaFactor;

			// =========================================================
			// PASO 4: FÓRMULA GROSS-UP (Inflar el precio final)
			// Dividimos nuestro objetivo de bolsillo por (1 - Tasa MP)
			// para que cuando MP nos saque la comisión, caigamos exacto en el target.
			// =========================================================
			const price1Payment = Math.round(targetPrice1Pay / (1 - cft1Factor));
			const price6Installments = Math.round(targetPriceInstallments / (1 - totalTasa6Cuotas));

			// Calculamos cuánto nos arranca MP en plata exacta para el dashboard de ganancias
			const mpTake1 = price1Payment * cft1Factor;
			const mpTake3 = price6Installments * totalTasa3Cuotas;
			const mpTake6 = price6Installments * totalTasa6Cuotas;

			// =========================================================
			// PASO 5: ARMAR LA RESPUESTA PARA EL FRONTEND
			// =========================================================
			return {
				costPrice: {
					inUSD: cost_price,
					inARS: basePriceInArs
				},
				dolarPrice: dolar,
				profitMargin: profitFactor1Pay, // Mostramos el margen de 1 pago como referencia
				profitMarginInstallments: profitFactorInstallments,
				profitMargin1Pay: profitFactor1Pay,
				baseCommission: baseCommFactor,
				cft6Cuotas: cft6Factor,

				// LOS PRECIOS PARA LA WEB
				efectivo_transferencia: Math.round(price1Payment),
				tarjeta_credito_debito: price6Installments, // Este es el Precio de Lista
				cuotas: {
					cuotas_3_si: Math.round(price6Installments / 3),
					cuotas_6_si: Math.round(price6Installments / 6)
				},

				// NUESTRAS GANANCIAS LIMPIAS (Lo que llega al banco - el costo de la zapatilla)
				earnings: {
					// Si es por transferencia, no pagamos la comisión de MP y ganamos esa plata extra
					cash_transfer: Math.round(price1Payment - basePriceInArs),
					card_1_installments: Math.round(price1Payment - basePriceInArs - mpTake1),
					// Cuotas: Precio Lista - Costo - Tajada de MP
					card_3_installments: Math.round(price6Installments - basePriceInArs - mpTake3),
					card_6_installments: Math.round(price6Installments - basePriceInArs - mpTake6),

					// Ticket (Pago Fácil / Rapipago) cobra lo mismo que 1 pago / débito
					ticket: Math.round(price1Payment - basePriceInArs - mpTake1)
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

	private static normalizePercentage(value: number): number {
		if (!value) return 0;
		// Si alguien pone 18 o 10, lo llevamos a 0.18 o 0.10
		// Si alguien ya puso 0.049, lo dejamos como está
		return value >= 1 ? value / 100 : value;
	}
}
