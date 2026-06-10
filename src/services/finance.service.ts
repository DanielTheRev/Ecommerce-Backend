import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import {
	EcommercePaymentProviders,
	IPricingStrategy,
	PricingMethod
} from '@/interfaces/ecommerce.interface';
import { IProductPrices, IProductFinance, ICostConcept } from '@/interfaces/product.interface';
import { EcommerceService } from './ecommerce.service';

/**
 * Servicio financiero encargado de calcular los precios de venta de un producto
 * según la estrategia de pricing configurada por el vendedor.
 *
 * Responsabilidades:
 * - Calcular precios finales (efectivo, tarjeta, cuotas) basados en el peor escenario (6 cuotas)
 * - Aplicar la fórmula correcta según pricingStrategy (markup/margin)
 * - Calcular ganancias estimadas por medio de pago
 *
 * NO se encarga de: procesar pagos, hablar con pasarelas, ni gestionar órdenes.
 */
export class FinanceService {
	private constructor() {}

	private static readonly DEFAULT_STRATEGY: IPricingStrategy = {
		method: 'markup',
		transferGrossUp: true,
		absorbInstallments: true
	};

	// =========================================================
	// CÁLCULO DE PRECIO DE LISTA
	// =========================================================
	static async CalculateListPrice(data: {
		models?: TenantModels;
		config?: any;
		providerCost: number;
		additionalCosts: ICostConcept[] | [];
		useCustomProfit?: boolean;
		pricingMethodChoice?: PricingMethod;
		customProfitMargin?: number;
		dolar: number;
	}) {
		const {
			models,
			providerCost,
			additionalCosts,
			useCustomProfit,
			pricingMethodChoice,
			customProfitMargin,
			dolar
		} = data;

		const EcommerceConfig = data.config || (models ? await EcommerceService.getConfig(models) : null);

		if (!EcommerceConfig)
			throw new AppError(
				'Models or config are required to calculate list price',
				'Se requieren los modelos o la configuración para calcular el precio de lista',
				400
			);

		const mpConfig = EcommerceConfig.paymentGateways.mercadopago;

		const isCustomProfit = typeof useCustomProfit === 'string'
			? useCustomProfit === 'true'
			: Boolean(useCustomProfit);

		const profitMargin =
			isCustomProfit && customProfitMargin !== undefined
				? Number(customProfitMargin)
				: Number(EcommerceConfig.profit);

		let totalAdditionalCostsRaw = 0;

		const strategyMethod =
			isCustomProfit && pricingMethodChoice
				? pricingMethodChoice
				: EcommerceConfig.pricingStrategy.method;

		const processedAdditionalCosts = additionalCosts.map((item) => {
			let costRaw = 0;
			const itemValue = Number(item.value);
			if (item.type === 'fixed') {
				costRaw = itemValue;
			} else if (item.type === 'percent_over_provider') {
				costRaw = Number(providerCost) * (itemValue / 100);
			}
			totalAdditionalCostsRaw += costRaw;
			return {
				concept: item.concept,
				type: item.type,
				value: itemValue
			};
		});

		// Comisiones de Mercado Pago
		const rawBaseComm = mpConfig.baseCommission;
		const rawCFT3 = mpConfig.cft3cuotas;
		const rawCFT6 = mpConfig.cft6Cuotas;

		const baseCommFactor = this.normalizePercentage(Number(rawBaseComm));
		const cft3Factor = this.normalizePercentage(Number(rawCFT3));
		const cft6Factor = this.normalizePercentage(Number(rawCFT6));
		const ivaFactor = 1 + Number(EcommerceConfig.taxes.iva) / 100;

		const isARS = EcommerceConfig.costCurrency === 'ARS';
		const totalCostRaw = Number(providerCost) + totalAdditionalCostsRaw;

		// Convertimos los costos a ambas monedas
		let providerCostInUSD = 0;
		let providerCostInARS = 0;
		let totalCostInARS = 0;

		if (isARS) {
			providerCostInARS = Number(providerCost);
			providerCostInUSD = Number(providerCost) / Number(dolar);
			totalCostInARS = totalCostRaw;
		} else {
			providerCostInUSD = Number(providerCost);
			providerCostInARS = Number(providerCost) * Number(dolar);
			totalCostInARS = totalCostRaw * Number(dolar);
		}

		// Tasas de pasarela con IVA incluido
		const totalTasa1 = baseCommFactor * ivaFactor; // 1 pago
		const totalTasa3 = (baseCommFactor + cft3Factor) * ivaFactor; // 3 cuotas
		const totalTasa6 = (baseCommFactor + cft6Factor) * ivaFactor; // 6 cuotas

		const profitFactor = this.normalizePercentage(profitMargin);

		const maxInstallments = mpConfig?.maxInstallments ?? 1;

		let worstCaseTasa = totalTasa1;
		if (maxInstallments >= 6) {
			worstCaseTasa = totalTasa6;
		} else if (maxInstallments >= 3) {
			worstCaseTasa = totalTasa3;
		}

		let listPrice = 0;
		let card_ticket1PayPrice = 0;
		let priceTarget = 0;

		// =========================================================
		// CÁLCULO DE PRECIOS FINALES (Gross-up Unificado)
		// =========================================================
		if (strategyMethod === 'margin') {
			listPrice = totalCostInARS / (1 - profitFactor - worstCaseTasa);
			card_ticket1PayPrice = totalCostInARS / (1 - profitFactor - totalTasa1);
			priceTarget = totalCostInARS / (1 - profitFactor);
		} else {
			const baseMarkupPrice = totalCostInARS * (1 + profitFactor);
			listPrice = baseMarkupPrice / (1 - worstCaseTasa);
			card_ticket1PayPrice = baseMarkupPrice / (1 - totalTasa1);
			priceTarget = baseMarkupPrice;
		}

		// Redondeos finales de cara al público
		listPrice = Math.round(listPrice);
		card_ticket1PayPrice = Math.round(card_ticket1PayPrice);

		// Distribución de cuotas sin interés basadas en el precio máster
		const sixPaymentsAmount = Math.round(listPrice / 6);
		const threePaymentsAmount = Math.round(listPrice / 3);

		// =========================================================
		// GANANCIAS NETAS EN ARS
		// =========================================================
		const card_ticket1PayProfit =
			card_ticket1PayPrice - totalCostInARS - card_ticket1PayPrice * totalTasa1;
		const card3InstallmentsProfit = listPrice - totalCostInARS - listPrice * totalTasa3;
		const card6InstallmentsProfit = listPrice - totalCostInARS - listPrice * totalTasa6;

		const maxSafeDiscount =
			listPrice > 0 ? Math.round(((listPrice - priceTarget) / listPrice) * 100) : 0;

		// =========================================================
		// DESGLOSE ESTRATÉGICO PARA LOS BLOQUES DE LA UI
		// =========================================================
		const additionalCostsInARS = isARS
			? totalAdditionalCostsRaw
			: totalAdditionalCostsRaw * dolar;

		const pasarelaAmount = Math.round(listPrice * worstCaseTasa);
		const tuGananciaPura = Math.round(
			maxInstallments >= 6 ? card6InstallmentsProfit :
			maxInstallments >= 3 ? card3InstallmentsProfit :
			card_ticket1PayProfit
		);

		const breakdown = [
			{
				label: 'Costo Proveedor',
				value: Math.round(providerCostInARS),
				percentage: listPrice > 0 ? Math.round((providerCostInARS / listPrice) * 100) : 0
			},
			{
				label: 'Gastos Adicionales',
				value: Math.round(additionalCostsInARS),
				percentage: listPrice > 0 ? Math.round((additionalCostsInARS / listPrice) * 100) : 0
			},
			{
				label: `Tu Ganancia (${profitMargin}%)`,
				value: tuGananciaPura,
				percentage: listPrice > 0 ? Math.round((tuGananciaPura / listPrice) * 100) : 0
			},
			{
				label: `Pasarela MP (Tarifa Base + CFT ${maxInstallments >= 6 ? '6 Cuotas' : maxInstallments >= 3 ? '3 Cuotas' : '1 Pago'} - ${Math.round(worstCaseTasa * 100)}%)`,
				value: pasarelaAmount,
				percentage: listPrice > 0 ? Math.round((pasarelaAmount / listPrice) * 100) : 0
			}
		];

		// Cuotas sin interés
		const absorbInstallments = EcommerceConfig.pricingStrategy?.absorbInstallments ?? true;
		const hasThreeInstallmentsSeamless = absorbInstallments && maxInstallments >= 3;
		const hasSixInstallmentsSeamless = absorbInstallments && maxInstallments >= 6;

		const result = {
			listPrice,
			one_pay: card_ticket1PayPrice,
			installments: {
				threePaymentsAmount,
				sixPaymentsAmount
			},
			commissions: {
				base: rawBaseComm,
				cft3Cuotas: rawCFT3,
				cft6Cuotas: rawCFT6
			},
			profits: {
				one_pay: Math.round(card_ticket1PayProfit),
				three_installments: Math.round(card3InstallmentsProfit),
				six_installments: Math.round(card6InstallmentsProfit)
			},
			processedAdditionalCosts,
			breakdown,
			maxSafeDiscount,
			// Datos internos para composición con CalculateTransferPrice y CalculatePrices
			_internal: {
				totalCostInARS,
				providerCostInARS,
				providerCostInUSD,
				priceTarget,
				processedAdditionalCosts,
				profitMargin,
				strategyMethod,
				card_ticket1PayProfit,
				card3InstallmentsProfit,
				card6InstallmentsProfit,
				totalTasa1,
				totalTasa3,
				totalTasa6,
				rawBaseComm,
				rawCFT3,
				rawCFT6,
				hasThreeInstallmentsSeamless,
				hasSixInstallmentsSeamless,
				dolar,
			}
		};

		return result;
	}

	// =========================================================
	// CÁLCULO DE PRECIO DE TRANSFERENCIA
	// =========================================================
	/**
	 * Calcula el precio de transferencia aplicando un descuento porcentual al precio de lista.
	 * Sin clamping: el vendedor puede exceder maxSafeDiscount conscientemente (se come ganancia).
	 * Si no viene discountPercentageTransfer, usa maxSafeDiscount como default.
	 */
	static CalculateTransferPrice(data: {
		listPrice: number;
		discountPercentageTransfer?: number;
		maxSafeDiscount: number;
		totalCostInARS: number;
	}): {
		cashTransferPrice: number;
		discountPercentageTransfer: number;
		transferProfit: number;
	} {
		const discount = data.discountPercentageTransfer !== undefined
			? Number(data.discountPercentageTransfer)
			: Number(data.maxSafeDiscount);

		const cashTransferPrice = Math.round(Number(data.listPrice) * (1 - discount / 100));
		const transferProfit = cashTransferPrice - Number(data.totalCostInARS);

		return {
			cashTransferPrice,
			discountPercentageTransfer: discount,
			transferProfit: Math.round(transferProfit),
		};
	}

	// =========================================================
	// PUNTO DE ENTRADA PRINCIPAL (COMPOSITOR)
	// =========================================================
	/**
	 * Compone CalculateListPrice + CalculateTransferPrice para producir
	 * el resultado completo { price, finance } que se persiste en el producto.
	 */
	static async CalculatePrices(data: {
		providerCost: number;
		additionalCosts?: ICostConcept[];
		discountPercentageTransfer?: number;
		useCustomProfit?: boolean;
		customProfitMargin?: number;
		pricingMethodChoice?: PricingMethod;
		dolar: number;
		models?: TenantModels;
		config?: any;
	}): Promise<{ price: IProductPrices; finance: IProductFinance }> {
		try {
			// 1. Calcular precio de lista
			const listResult = await this.CalculateListPrice({
				models: data.models,
				config: data.config,
				providerCost: Number(data.providerCost),
				additionalCosts: data.additionalCosts || [],
				useCustomProfit: typeof data.useCustomProfit === 'string' ? data.useCustomProfit === 'true' : Boolean(data.useCustomProfit),
				customProfitMargin: data.customProfitMargin !== undefined ? Number(data.customProfitMargin) : undefined,
				pricingMethodChoice: data.pricingMethodChoice,
				dolar: Number(data.dolar),
			});

			// 2. Calcular precio de transferencia
			const transferResult = this.CalculateTransferPrice({
				listPrice: listResult.listPrice,
				discountPercentageTransfer: data.discountPercentageTransfer !== undefined ? Number(data.discountPercentageTransfer) : undefined,
				maxSafeDiscount: listResult.maxSafeDiscount,
				totalCostInARS: listResult._internal.totalCostInARS,
			});

			// 3. Ensamblar resultado
			const { _internal: i } = listResult;

			const price: IProductPrices = {
				listPrice: listResult.listPrice,
				card_ticket1PayPrice: listResult.one_pay,
				cashTransferPrice: transferResult.cashTransferPrice,
				discountPercentageTransfer: transferResult.discountPercentageTransfer,
				installments: {
					threePaymentsAmount: listResult.installments.threePaymentsAmount,
					sixPaymentsAmount: listResult.installments.sixPaymentsAmount,
					hasThreeInstallmentsSeamless: i.hasThreeInstallmentsSeamless,
					hasSixInstallmentsSeamless: i.hasSixInstallmentsSeamless,
				},
			};

			const finance: IProductFinance = {
				exchangeRateSnapshot: Number(data.dolar),
				mpCommissionSnapshot: {
					base: i.rawBaseComm,
					cft3Cuotas: i.rawCFT3,
					cft6Cuotas: i.rawCFT6,
				},
				providerCost: {
					inUSD: i.providerCostInUSD,
					inARS: i.providerCostInARS,
				},
				additionalCosts: i.processedAdditionalCosts,
				pricingStrategy: {
					method: i.strategyMethod as PricingMethod,
					targetProfit: i.profitMargin,
				},
				calculatedProfits: {
					transfer: transferResult.transferProfit,
					card_ticket1Pay: Math.round(i.card_ticket1PayProfit),
					card3Installments: Math.round(i.card3InstallmentsProfit),
					card6Installments: Math.round(i.card6InstallmentsProfit),
				},
				maxSafeDiscount: listResult.maxSafeDiscount,
			};

			return { price, finance };
		} catch (error) {
			if (error instanceof AppError) throw error;
			console.error('Error in FinanceService.CalculatePrices:', error);
			throw new AppError(
				'Failed to calculate prices on FinanceService.CalculatePrices',
				'Error al calcular los precios',
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
	private static applyMargin(
		basePriceInArs: number,
		profitFactor: number,
		method: string
	): number {
		if (method === 'margin') {
			if (profitFactor >= 1) {
				throw new AppError(
					'Margin percentage must be less than 100% when using margin method',
					'El porcentaje de margen debe ser menor a 100% cuando se usa el método "sobre la venta"',
					400
				);
			}
			return basePriceInArs / (1 - profitFactor);
		}
		return basePriceInArs * (1 + profitFactor);
	}

	static normalizePercentage(value: number): number {
		if (!value) return 0;
		return value >= 1 ? value / 100 : value;
	}
}
