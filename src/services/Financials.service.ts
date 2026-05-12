import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders, IPricingStrategy, PricingMethod } from '@/interfaces/ecommerce.interface';
import { IProductPrices } from '@/interfaces/product.interface';
import { EcommerceService } from './ecommerce.service';

/**
 * Servicio financiero encargado de calcular los precios de venta de un producto
 * según la estrategia de pricing configurada por el vendedor.
 *
 * Responsabilidades:
 * - Calcular precios finales (efectivo, tarjeta, cuotas)
 * - Aplicar la fórmula correcta según pricingStrategy (markup/margin, grossUp, absorbInstallments)
 * - Calcular ganancias estimadas por medio de pago
 *
 * NO se encarga de: procesar pagos, hablar con pasarelas, ni gestionar órdenes.
 */
export class FinancialsService {
	private constructor() { }

	// =========================================================
	// DEFAULTS — mantienen el comportamiento actual si la config no tiene pricingStrategy
	// =========================================================
	private static readonly DEFAULT_STRATEGY: IPricingStrategy = {
		method: 'markup',
		transferGrossUp: true,
		absorbInstallments: true
	};

	// =========================================================
	// PUNTO DE ENTRADA PRINCIPAL
	// =========================================================
	static async CalculatePrices(
		data: {
			paymentProvider: EcommercePaymentProviders,
			cost_price: number,
			dolar: number,
			models?: TenantModels,
			config?: any,
			customProfitMargin?: number,
			customProfitMargin1Pay?: number,
			customProfitMarginInstallments?: number,
			customPricingMethod?: PricingMethod
		}
	): Promise<IProductPrices> {
		try {
			return await this.calculatePricesWithMercadoPago(data);
		} catch (error) {
			console.error('Error in FinancialsService.CalculatePrices:', error);
			throw new AppError(
				'Failed to calculate prices on FinancialsService.CalculatePrices',
				'Error al calcular los precios',
				500
			);
		}
	}

	// =========================================================
	// MOTOR DE CÁLCULO
	// =========================================================
	private static async calculatePricesWithMercadoPago(
		data: {
			cost_price: number,
			dolar: number,
			models?: TenantModels,
			config?: any,
			customProfitMargin?: number,
			customProfitMargin1Pay?: number,
			customProfitMarginInstallments?: number,
			customPricingMethod?: PricingMethod
		}
	): Promise<IProductPrices> {
		try {
			const { cost_price, dolar, models, customProfitMargin, customProfitMargin1Pay, customProfitMarginInstallments, customPricingMethod } = data;
			const config = data.config || await EcommerceService.getConfig(models!);
			const mpConfig = config.paymentGateways.mercadopago;

			// =========================================================
			// ESTRATEGIA DE PRICING (configurable por el vendedor)
			// =========================================================
			const strategy: IPricingStrategy = {
				...this.DEFAULT_STRATEGY,
				...(config.pricingStrategy || {})
			};

			// =========================================================
			// PASO 1: DEFINIR QUÉ GANANCIA USAR
			// Cascada: custom por producto → global específico → global legacy
			// =========================================================
			const globalProfit1Pay = config.profit1Pay ?? config.profit;
			const globalProfitInstallments = config.profitInstallments ?? config.profit1Pay ?? config.profit;

			const rawProfit1Pay = customProfitMargin1Pay ?? customProfitMargin ?? globalProfit1Pay;
			const rawProfitInstallments = customProfitMarginInstallments ?? customProfitMargin1Pay ?? globalProfitInstallments;

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
			// PASO 2: COSTO BASE
			// =========================================================
			const isARS = config.costCurrency === 'ARS';
			const basePriceInArs = isARS ? cost_price : cost_price * dolar;
			const inUSD = isARS ? cost_price / dolar : cost_price;

			// =========================================================
			// PASO 3: PRECIO TARGET (lo que queremos en mano)
			// El método por producto overridea el global si existe
			// =========================================================
			const effectiveMethod = customPricingMethod || strategy.method;
			const targetPrice1Pay = this.applyMargin(basePriceInArs, profitFactor1Pay, effectiveMethod);
			const targetPriceInstallments = this.applyMargin(basePriceInArs, profitFactorInstallments, effectiveMethod);

			// =========================================================
			// PASO 4: COMISIONES TOTALES DE MERCADO PAGO
			// =========================================================
			const cft1Factor = baseCommFactor * ivaFactor; // Débito, Crédito 1 Pago, Dinero MP
			const totalTasa3Cuotas = (baseCommFactor + cft3Factor) * ivaFactor;
			const totalTasa6Cuotas = (baseCommFactor + cft6Factor) * ivaFactor;

			// =========================================================
			// PASO 5: PRECIOS FINALES SEGÚN ESTRATEGIA
			// =========================================================

			// -- Precio 1 Pago (con gross-up de comisión base MP) --
			const price1PaymentGrossUp = Math.round(targetPrice1Pay / (1 - cft1Factor));

			// -- Precio Efectivo/Transferencia --
			// Si transferGrossUp = true: iguala a tarjeta 1 pago (actual)
			// Si transferGrossUp = false: precio limpio sin comisión de pasarela
			const efectivo_transferencia = strategy.transferGrossUp
				? price1PaymentGrossUp
				: Math.round(targetPrice1Pay);

			// -- Precio Tarjeta (Cuotas) --
			let tarjeta_credito_debito: number;
			let cuotas_3_si = 0;
			let cuotas_6_si = 0;

			if (strategy.absorbInstallments) {
				// El vendedor absorbe CFT → cuotas sin interés, precio inflado
				tarjeta_credito_debito = Math.round(targetPriceInstallments / (1 - totalTasa6Cuotas));
				cuotas_3_si = Math.round(tarjeta_credito_debito / 3);
				cuotas_6_si = Math.round(tarjeta_credito_debito / 6);
			} else {
				// El vendedor NO ofrece cuotas sin interés
				// Precio tarjeta = solo con comisión base (sin CFT)
				tarjeta_credito_debito = price1PaymentGrossUp;
				cuotas_3_si = 0;
				cuotas_6_si = 0;
			}

			// =========================================================
			// PASO 6: GANANCIAS POR MEDIO DE PAGO
			// =========================================================
			const mpTake1 = price1PaymentGrossUp * cft1Factor;
			const mpTakeTransfer = strategy.transferGrossUp ? mpTake1 : (efectivo_transferencia * cft1Factor);
			const mpTake3 = tarjeta_credito_debito * totalTasa3Cuotas;
			const mpTake6 = tarjeta_credito_debito * totalTasa6Cuotas;

			// =========================================================
			// PASO 7: RESPUESTA
			// =========================================================
			return {
				costPrice: {
					inUSD: inUSD,
					inARS: basePriceInArs
				},
				dolarPrice: dolar,
				profitMargin: profitFactor1Pay,
				profitMarginInstallments: profitFactorInstallments,
				profitMargin1Pay: profitFactor1Pay,
				baseCommission: baseCommFactor,
				cft6Cuotas: cft6Factor,
				customPricingMethod: customPricingMethod || undefined,

				// LOS PRECIOS PARA LA WEB
				efectivo_transferencia,
				tarjeta_credito_debito,
				cuotas: {
					cuotas_3_si,
					cuotas_6_si
				},

				// GANANCIAS LIMPIAS
				earnings: {
					// Transferencia: si grossUp=true, cobra inflado sin pagar comisión.
					// Si grossUp=false, cobra el precio limpio sin comisión.
					cash_transfer: Math.round(efectivo_transferencia - basePriceInArs),

					// Tarjeta 1 pago: siempre paga comisión base de MP
					card_1_installments: Math.round(price1PaymentGrossUp - basePriceInArs - mpTake1),

					// Cuotas (solo si absorbInstallments)
					card_3_installments: strategy.absorbInstallments
						? Math.round(tarjeta_credito_debito - basePriceInArs - mpTake3)
						: Math.round(price1PaymentGrossUp - basePriceInArs - mpTake1),
					card_6_installments: strategy.absorbInstallments
						? Math.round(tarjeta_credito_debito - basePriceInArs - mpTake6)
						: Math.round(price1PaymentGrossUp - basePriceInArs - mpTake1),

					// Ticket (Pago Fácil / Rapipago) — cobra lo mismo que 1 pago
					ticket: Math.round(price1PaymentGrossUp - basePriceInArs - mpTake1)
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

	// =========================================================
	// UTILIDADES
	// =========================================================

	/**
	 * Aplica el margen según el método elegido por el vendedor.
	 * - markup: costo × (1 + margen)  → 50% sobre $10k = $15k
	 * - margin: costo / (1 - margen)  → 50% sobre $10k = $20k
	 */
	private static applyMargin(basePriceInArs: number, profitFactor: number, method: string): number {
		if (method === 'margin') {
			// Validar que el margen sea < 1 para evitar división por cero/precios negativos
			if (profitFactor >= 1) {
				throw new AppError(
					'Margin percentage must be less than 100% when using margin method',
					'El porcentaje de margen debe ser menor a 100% cuando se usa el método "sobre la venta"',
					400
				);
			}
			return basePriceInArs / (1 - profitFactor);
		}
		// Default: markup
		return basePriceInArs * (1 + profitFactor);
	}

	static normalizePercentage(value: number): number {
		if (!value) return 0;
		// Si alguien pone 18 o 10, lo llevamos a 0.18 o 0.10
		// Si alguien ya puso 0.049, lo dejamos como está
		return value >= 1 ? value / 100 : value;
	}
}
