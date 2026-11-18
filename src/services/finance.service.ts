import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import {
	EcommercePaymentProviders,
	IPricingStrategy,
	PricingMethod
} from '@/interfaces/ecommerce.interface';
import {
	IChannelPriceSnapshot,
	IChannelPricingConfig,
	IChannelPricingRule,
	ICostConcept,
	IPricingInsight,
	IProductFinance,
	IProductPrices,
	PricingChannelKey
} from '@/interfaces/product.interface';
import { PriceBuilderEngine } from '@/addons/price_builder';
import { IPriceBuilderChannelPricing } from '@/addons/price_builder/priceBuilder.types';
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

		const activeGateway = this.resolveActiveGateway(EcommerceConfig);

		const hasValidCustomMargin = customProfitMargin !== undefined && customProfitMargin !== null && !isNaN(Number(customProfitMargin));
		const isCustomProfit = useCustomProfit !== undefined
			? (typeof useCustomProfit === 'string' ? useCustomProfit === 'true' : Boolean(useCustomProfit))
			: hasValidCustomMargin;

		const profitMargin =
			isCustomProfit && hasValidCustomMargin
				? Number(customProfitMargin)
				: Number(EcommerceConfig.profit);

		let fixedExpensesRaw = 0;
		let percentOverProviderExpensesRaw = 0;
		let fixedTaxesRaw = 0;
		let percentOverProviderTaxesRaw = 0;
		let taxRateOnSaleFactor = 0;

		const strategyMethod =
			isCustomProfit && pricingMethodChoice
				? pricingMethodChoice
				: EcommerceConfig.pricingStrategy.method;

		const isARS = EcommerceConfig.costCurrency === 'ARS';

		const processedAdditionalCosts = additionalCosts.map((item) => {
			const itemValue = Number(item.value) || 0;
			const category = item.category || 'expense';
			const type = item.type || 'fixed';
			let calculatedAmountInARS = 0;

			if (type === 'fixed') {
				calculatedAmountInARS = isARS ? itemValue : itemValue * Number(dolar);
				if (category === 'tax') {
					fixedTaxesRaw += itemValue;
				} else {
					fixedExpensesRaw += itemValue;
				}
			} else if (type === 'percent_over_provider') {
				const cost = Number(providerCost) * (itemValue / 100);
				calculatedAmountInARS = isARS ? cost : cost * Number(dolar);
				if (category === 'tax') {
					percentOverProviderTaxesRaw += cost;
				} else {
					percentOverProviderExpensesRaw += cost;
				}
			} else if (type === 'percent_over_price') {
				taxRateOnSaleFactor += this.normalizePercentage(itemValue);
			}

			return {
				concept: item.concept,
				type,
				category,
				value: itemValue,
				calculatedAmountInARS: Math.round(calculatedAmountInARS)
			};
		});

		// Comisiones de la pasarela activa / por defecto
		const rawBaseComm = activeGateway.baseCommission;
		const rawCFT3 = activeGateway.cft3cuotas;
		const rawCFT6 = activeGateway.cft6Cuotas;

		const baseCommFactor = this.normalizePercentage(Number(rawBaseComm));
		const cft3Factor = this.normalizePercentage(Number(rawCFT3));
		const cft6Factor = this.normalizePercentage(Number(rawCFT6));
		const ivaFactor = 1 + Number(EcommerceConfig.taxes?.iva || 21) / 100;

		const totalOperationalExpensesRaw = fixedExpensesRaw + percentOverProviderExpensesRaw;
		const totalTaxesOverProviderRaw = fixedTaxesRaw + percentOverProviderTaxesRaw;

		// Convertimos los costos a ambas monedas
		let providerCostInUSD = 0;
		let providerCostInARS = 0;
		let operationalExpensesInARS = 0;
		let taxesOverProviderInARS = 0;

		if (isARS) {
			providerCostInARS = Number(providerCost);
			providerCostInUSD = Number(providerCost) / Number(dolar);
			operationalExpensesInARS = totalOperationalExpensesRaw;
			taxesOverProviderInARS = totalTaxesOverProviderRaw;
		} else {
			providerCostInUSD = Number(providerCost);
			providerCostInARS = Number(providerCost) * Number(dolar);
			operationalExpensesInARS = totalOperationalExpensesRaw * Number(dolar);
			taxesOverProviderInARS = totalTaxesOverProviderRaw * Number(dolar);
		}

		// Costo base total en ARS antes de comisiones y antes de impuestos sobre venta
		const totalCostInARS = providerCostInARS + operationalExpensesInARS + taxesOverProviderInARS;

		// Tasas de pasarela con IVA incluido
		const totalTasa1 = baseCommFactor * ivaFactor; // 1 pago
		const totalTasa3 = (baseCommFactor + cft3Factor) * ivaFactor; // 3 cuotas
		const totalTasa6 = (baseCommFactor + cft6Factor) * ivaFactor; // 6 cuotas

		const profitFactor = this.normalizePercentage(profitMargin);

		const maxInstallments = activeGateway.maxInstallments;
		const absorbInstallments = EcommerceConfig.pricingStrategy?.absorbInstallments ?? true;

		let worstCaseTasa = totalTasa1;
		if (absorbInstallments) {
			if (maxInstallments >= 6) {
				worstCaseTasa = totalTasa6;
			} else if (maxInstallments >= 3) {
				worstCaseTasa = totalTasa3;
			}
		}

		let listPrice = 0;
		let card_ticket1PayPrice = 0;
		let priceTarget = 0;

		// =========================================================
		// CÁLCULO DE PRECIOS FINALES (Gross-up Unificado con Impuestos)
		// =========================================================
		const denomList = Math.max(0.05, 1 - worstCaseTasa - taxRateOnSaleFactor - (strategyMethod === 'margin' ? profitFactor : 0));
		const denom1Pay = Math.max(0.05, 1 - totalTasa1 - taxRateOnSaleFactor - (strategyMethod === 'margin' ? profitFactor : 0));
		const denomTarget = Math.max(0.05, 1 - taxRateOnSaleFactor - (strategyMethod === 'margin' ? profitFactor : 0));

		if (strategyMethod === 'margin') {
			listPrice = totalCostInARS / denomList;
			card_ticket1PayPrice = totalCostInARS / denom1Pay;
			priceTarget = totalCostInARS / denomTarget;
		} else {
			const baseMarkupPrice = totalCostInARS * (1 + profitFactor);
			listPrice = baseMarkupPrice / denomList;
			card_ticket1PayPrice = baseMarkupPrice / denom1Pay;
			priceTarget = baseMarkupPrice / denomTarget;
		}

		// Redondeos finales de cara al público (Charm Pricing .000, .500, .900)
		listPrice = this.roundCharmPrice(listPrice);
		card_ticket1PayPrice = this.roundCharmPrice(card_ticket1PayPrice);

		// Distribución de cuotas sin interés basadas en el precio máster
		const sixPaymentsAmount = Math.round(listPrice / 6);
		const threePaymentsAmount = Math.round(listPrice / 3);

		// =========================================================
		// GANANCIAS NETAS REALES EN ARS (Cobrando Precio de Lista)
		// =========================================================
		const listPriceTaxesOnSale = listPrice * taxRateOnSaleFactor;
		const card_ticket1PayProfit =
			listPrice - totalCostInARS - listPrice * totalTasa1 - listPriceTaxesOnSale;
		const card3InstallmentsProfit =
			listPrice - totalCostInARS - listPrice * totalTasa3 - listPriceTaxesOnSale;
		const card6InstallmentsProfit =
			listPrice - totalCostInARS - listPrice * totalTasa6 - listPriceTaxesOnSale;

		// El Descuento Máximo Seguro es exactamente la tasa de pasarela absorbida en el Precio de Lista
		const maxSafeDiscount = Math.round(worstCaseTasa * 100);

		// =========================================================
		// DESGLOSE ESTRATÉGICO PARA LOS BLOQUES DE LA UI
		// =========================================================
		const pasarelaAmount = Math.round(listPrice * worstCaseTasa);
		const totalTaxesInARS = Math.round(taxesOverProviderInARS + listPriceTaxesOnSale);
		const tuGananciaPura = Math.round(
			maxInstallments >= 6 ? card6InstallmentsProfit :
			maxInstallments >= 3 ? card3InstallmentsProfit :
			card_ticket1PayProfit
		);

		const breakdown = [
			{
				label: 'Costo Proveedor',
				value: Math.round(providerCostInARS),
				percentage: listPrice > 0 ? Math.round((providerCostInARS / listPrice) * 100) : 0,
				category: 'provider'
			},
			{
				label: 'Gastos Operativos',
				value: Math.round(operationalExpensesInARS),
				percentage: listPrice > 0 ? Math.round((operationalExpensesInARS / listPrice) * 100) : 0,
				category: 'expense'
			},
			{
				label: `Impuestos & Retenciones (${Math.round(taxRateOnSaleFactor * 100)}%)`,
				value: totalTaxesInARS,
				percentage: listPrice > 0 ? Math.round((totalTaxesInARS / listPrice) * 100) : 0,
				category: 'tax'
			},
			{
				label: `Pasarela MP (Tarifa Base + CFT ${maxInstallments >= 6 ? '6 Cuotas' : maxInstallments >= 3 ? '3 Cuotas' : '1 Pago'} - ${Math.round(worstCaseTasa * 100)}%)`,
				value: pasarelaAmount,
				percentage: listPrice > 0 ? Math.round((pasarelaAmount / listPrice) * 100) : 0,
				category: 'gateway'
			},
			{
				label: `Tu Ganancia (${profitMargin}%)`,
				value: tuGananciaPura,
				percentage: listPrice > 0 ? Math.round((tuGananciaPura / listPrice) * 100) : 0,
				category: 'profit'
			}
		];

		// Cuotas sin interés
		const hasThreeInstallmentsSeamless = absorbInstallments && maxInstallments >= 3;
		const hasSixInstallmentsSeamless = absorbInstallments && maxInstallments >= 6;

		const result = {
			listPrice,
			one_pay: card_ticket1PayPrice,
			maxInstallments,
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
				operationalExpensesInARS,
				totalTaxesInARS,
				taxRateOnSaleFactor,
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
				absorbInstallments,
				activeGateway,
				ivaFactor,
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
		taxRateOnSaleFactor?: number;
	}): {
		cashTransferPrice: number;
		discountPercentageTransfer: number;
		transferProfit: number;
	} {
		const discount = data.discountPercentageTransfer !== undefined
			? Number(data.discountPercentageTransfer)
			: Number(data.maxSafeDiscount);

		const cashTransferPrice = this.roundCharmPrice(Number(data.listPrice) * (1 - discount / 100));
		const taxOnSale = cashTransferPrice * (Number(data.taxRateOnSaleFactor) || 0);
		const transferProfit = cashTransferPrice - Number(data.totalCostInARS) - taxOnSale;

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
		channelPricing?: IChannelPricingConfig | string;
		paymentRestrictions?: { allowCardPayment?: boolean; allowInterestFreeInstallments?: boolean; maxInstallments?: number };
		useCustomProfit?: boolean;
		customProfitMargin?: number;
		pricingMethodChoice?: PricingMethod;
		dolar: number;
		models?: TenantModels;
		config?: any;
	}): Promise<{ price: IProductPrices; finance: IProductFinance; insights: IPricingInsight[]; activeGateway: { key: string; label: string } }> {
		try {
			const EcommerceConfig = data.config || (data.models ? await EcommerceService.getConfig(data.models) : null);
			if (!EcommerceConfig) {
				throw new AppError(
					'Ecommerce config not found',
					'No se encontró la configuración de Ecommerce para calcular precios.',
					500
				);
			}

			const parsedChannelPricing = this.parseChannelPricingInput(data.channelPricing) as IPriceBuilderChannelPricing | undefined;
			const useCustomProfit = data.useCustomProfit !== undefined
				? (typeof data.useCustomProfit === 'string' ? data.useCustomProfit === 'true' : Boolean(data.useCustomProfit))
				: (data.customProfitMargin !== undefined && data.customProfitMargin !== null && !isNaN(Number(data.customProfitMargin)));
			const customProfitMargin = data.customProfitMargin !== undefined && data.customProfitMargin !== null && !isNaN(Number(data.customProfitMargin))
				? Number(data.customProfitMargin)
				: undefined;

			const result = PriceBuilderEngine.calculate({
				providerCost: Number(data.providerCost),
				additionalCosts: data.additionalCosts,
				discountPercentageTransfer: data.discountPercentageTransfer !== undefined ? Number(data.discountPercentageTransfer) : undefined,
				channelPricing: parsedChannelPricing,
				paymentRestrictions: data.paymentRestrictions,
				useCustomProfit,
				customProfitMargin,
				pricingMethodChoice: data.pricingMethodChoice,
				dolar: Number(data.dolar),
				config: EcommerceConfig
			});

			const transferChannel = result.price.channels.transfer;
			const computedDiscount = transferChannel?.discountPercent !== undefined
				? transferChannel.discountPercent
				: (result.price.listPrice > 0
					? Math.max(0, Math.round(((result.price.listPrice - result.price.cashTransferPrice) / result.price.listPrice) * 100))
					: 0);

			const price: IProductPrices = {
				...result.price,
				discountPercentageTransfer: computedDiscount
			};

			return {
				price,
				finance: result.finance,
				insights: result.insights,
				activeGateway: result.activeGateway
			};
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
	// MOTOR MULTI-CANAL (EFECTIVO, TRANSFERENCIA, QR, DÉBITO, 1 PAGO, LISTA)
	// =========================================================

	private static resolveActiveGateway(config: any): {
		gatewayKey: 'mercadopago' | 'getnet' | 'uala' | 'none';
		label: string;
		baseCommission: number;
		qrCommission: number;
		debitCommission: number;
		cft3cuotas: number;
		cft6Cuotas: number;
		maxInstallments: number;
	} {
		const gateways = config?.paymentGateways || {};
		const labels: Record<'mercadopago' | 'getnet' | 'uala', string> = {
			mercadopago: 'Mercado Pago',
			getnet: 'Getnet',
			uala: 'Ualá Bis'
		};

		const activeKeys = (['mercadopago', 'getnet', 'uala'] as const).filter(
			(k) => Boolean(gateways[k]?.active)
		);

		let selectedKey: 'mercadopago' | 'getnet' | 'uala' | 'none' = 'none';
		const configuredDefault = gateways.defaultGateway as 'mercadopago' | 'getnet' | 'uala' | undefined;

		if (configuredDefault && gateways[configuredDefault]?.active) {
			selectedKey = configuredDefault;
		} else if (activeKeys.length === 1) {
			selectedKey = activeKeys[0];
		} else if (activeKeys.length > 1) {
			throw new AppError(
				'Default Gateway Required',
				'Tenés múltiples pasarelas de pago activas. Seleccioná una pasarela por defecto en Cobros y Pagos.',
				400
			);
		}

		if (selectedKey === 'none') {
			return {
				gatewayKey: 'none',
				label: 'Sin pasarela online activa',
				baseCommission: 0,
				qrCommission: 0,
				debitCommission: 0,
				cft3cuotas: 0,
				cft6Cuotas: 0,
				maxInstallments: 1
			};
		}

		const gw = gateways[selectedKey] || {};
		return {
			gatewayKey: selectedKey,
			label: labels[selectedKey],
			baseCommission: Number(gw.baseCommission || 0),
			qrCommission: Number(gw.qrCommission || 0),
			debitCommission: Number(gw.debitCommission || 0),
			cft3cuotas: Number(gw.cft3cuotas || 0),
			cft6Cuotas: Number(gw.cft6Cuotas || 0),
			maxInstallments: Number(gw.maxInstallments || 1)
		};
	}

	private static buildPricingInsights(params: {
		activeGateway: { gatewayKey: string; label: string; baseCommission: number; qrCommission: number; debitCommission: number };
		ivaFactor: number;
		absorbInstallments: boolean;
		maxInstallments: number;
		maxSafeDiscount: number;
		channels: Partial<Record<PricingChannelKey, IChannelPriceSnapshot>>;
	}): IPricingInsight[] {
		const insights: IPricingInsight[] = [];
		const { activeGateway, ivaFactor, absorbInstallments, maxInstallments, maxSafeDiscount, channels } = params;

		if (activeGateway.gatewayKey === 'none') {
			insights.push({
				type: 'info',
				code: 'NO_GATEWAY_ACTIVE',
				message: 'No tenés pasarelas online activas: los precios se calculan sin comisiones de tarjeta ni cuotas.'
			});
		} else {
			const effectiveBase = (activeGateway.baseCommission <= 1 ? activeGateway.baseCommission * 100 : activeGateway.baseCommission) * ivaFactor;
			insights.push({
				type: 'info',
				code: 'ACTIVE_GATEWAY',
				message: `Calculado con ${activeGateway.label} (comisión base efectiva con IVA: ${effectiveBase.toFixed(2)}%).`
			});
		}

		if (absorbInstallments && maxInstallments >= 3) {
			insights.push({
				type: 'info',
				code: 'INSTALLMENTS_ABSORBED',
				message: `Absorbés hasta ${maxInstallments} cuotas sin interés: el Precio de Lista incluye el CFT. Podés ofrecer hasta ${maxSafeDiscount}% OFF en efectivo/transferencia/QR sin perder tu margen.`
			});
		} else {
			insights.push({
				type: 'info',
				code: 'INSTALLMENTS_NOT_ABSORBED',
				message: 'No absorbés cuotas sin interés: el Precio de Lista coincide con 1 Pago Crédito y el interés de las cuotas lo abona el comprador.'
			});
		}

		const channelNames: Record<PricingChannelKey, string> = {
			cash: 'Efectivo',
			transfer: 'Transferencia',
			qr: 'QR',
			debit: 'Débito',
			credit1Pay: '1 Pago Crédito',
			list: 'Precio de Lista'
		};

		for (const key of Object.keys(channels) as PricingChannelKey[]) {
			const snap = channels[key];
			if (snap?.isWarningLoss) {
				insights.push({
					type: 'warning',
					code: `LOSS_WARNING_${key.toUpperCase()}`,
					message: `Atención: en el canal ${channelNames[key]} estás perdiendo $${Math.abs(snap.netProfit)} por venta.`
				});
			}
		}

		return insights;
	}

	private static parseChannelPricingInput(raw?: IChannelPricingConfig | string): IChannelPricingConfig | undefined {
		if (!raw) return undefined;
		if (typeof raw === 'string') {
			try {
				const parsed = JSON.parse(raw);
				return (parsed && typeof parsed === 'object' ? parsed : undefined) as IChannelPricingConfig | undefined;
			} catch {
				throw new AppError('Invalid channelPricing', 'El formato JSON de channelPricing es inválido.', 400);
			}
		}
		return raw;
	}

	private static resolveChannelPrices(params: {
		listPrice: number;
		onePayPrice: number;
		priceTarget: number;
		totalCostInARS: number;
		taxRateOnSaleFactor: number;
		totalTasa1: number;
		debitTasaFactor: number;
		qrTasaFactor: number;
		worstCaseTasa: number;
		discountPercentageTransfer: number;
		channelRules: IChannelPricingConfig;
	}): Partial<Record<PricingChannelKey, IChannelPriceSnapshot>> {
		const {
			listPrice,
			onePayPrice,
			priceTarget,
			totalCostInARS,
			taxRateOnSaleFactor,
			totalTasa1,
			debitTasaFactor,
			qrTasaFactor,
			worstCaseTasa,
			discountPercentageTransfer,
			channelRules
		} = params;

		const defaultRules: Record<'cash' | 'transfer' | 'qr' | 'debit' | 'credit1Pay', IChannelPricingRule> = {
			credit1Pay: { mode: 'auto' },
			transfer: { mode: 'discount_from_list', discountPercent: discountPercentageTransfer },
			qr: { mode: 'linked', linkedTo: 'transfer' },
			cash: { mode: 'linked', linkedTo: 'transfer' },
			debit: { mode: 'linked', linkedTo: 'credit1Pay' }
		};

		const effectiveRules: Record<'cash' | 'transfer' | 'qr' | 'debit' | 'credit1Pay', IChannelPricingRule> = {
			credit1Pay: channelRules.credit1Pay || defaultRules.credit1Pay,
			transfer: channelRules.transfer || defaultRules.transfer,
			qr: channelRules.qr || defaultRules.qr,
			cash: channelRules.cash || defaultRules.cash,
			debit: channelRules.debit || defaultRules.debit
		};

		const feeByChannel: Record<PricingChannelKey, number> = {
			cash: 0,
			transfer: 0,
			qr: qrTasaFactor,
			debit: debitTasaFactor,
			credit1Pay: totalTasa1,
			list: worstCaseTasa
		};

		const resolvedPrice = new Map<PricingChannelKey, number>();
		resolvedPrice.set('list', listPrice);

		const resolveSinglePrice = (key: PricingChannelKey, visiting: Set<PricingChannelKey>): number => {
			const cached = resolvedPrice.get(key);
			if (cached !== undefined) return cached;
			if (key === 'list') return listPrice;

			if (visiting.has(key)) {
				throw new AppError(
					'Invalid Channel Pricing',
					'Existe una referencia circular entre los canales de pago configurados.',
					400
				);
			}
			visiting.add(key);

			const rule = effectiveRules[key];
			let computed = 0;

			if (rule.mode === 'linked') {
				const target = rule.linkedTo;
				if (!target) {
					throw new AppError('Invalid Channel Pricing', `El canal '${key}' está en modo 'linked' sin indicar 'linkedTo'.`, 400);
				}
				computed = resolveSinglePrice(target, visiting);
			} else if (rule.mode === 'fixed') {
				const fixed = Number(rule.fixedPrice);
				if (rule.fixedPrice === undefined || isNaN(fixed) || fixed < 0) {
					throw new AppError('Invalid Channel Pricing', `El precio fijo del canal '${key}' debe ser un número válido >= 0.`, 400);
				}
				computed = Math.round(fixed);
			} else if (rule.mode === 'discount_from_list') {
				const discount = Number(rule.discountPercent ?? 0);
				if (isNaN(discount) || discount < 0 || discount >= 100) {
					throw new AppError('Invalid Channel Pricing', `El descuento del canal '${key}' debe estar entre 0 y 99.9%.`, 400);
				}
				computed = this.roundCharmPrice(listPrice * (1 - discount / 100));
			} else {
				// mode === 'auto'
				if (key === 'credit1Pay') {
					computed = onePayPrice;
				} else if (key === 'debit') {
					computed = this.roundCharmPrice(priceTarget / Math.max(0.05, 1 - debitTasaFactor));
				} else if (key === 'qr') {
					computed = this.roundCharmPrice(priceTarget / Math.max(0.05, 1 - qrTasaFactor));
				} else {
					computed = this.roundCharmPrice(priceTarget);
				}
			}

			visiting.delete(key);
			resolvedPrice.set(key, computed);
			return computed;
		};

		const buildSnapshot = (key: PricingChannelKey): IChannelPriceSnapshot => {
			const price = resolveSinglePrice(key, new Set<PricingChannelKey>());
			const feeFactor = feeByChannel[key];
			const netProfit = Math.round(price - totalCostInARS - price * feeFactor - price * taxRateOnSaleFactor);
			const netMarginPercent = price > 0 ? Math.round((netProfit / price) * 1000) / 10 : 0;
			const rule = key === 'list' ? { mode: 'auto' as const } : effectiveRules[key];
			const discountFromList = listPrice > 0 ? Math.round(((listPrice - price) / listPrice) * 1000) / 10 : 0;

			return {
				price,
				mode: rule.mode,
				...(rule.linkedTo ? { linkedTo: rule.linkedTo } : {}),
				...(rule.mode === 'discount_from_list'
					? { discountPercent: Number(rule.discountPercent ?? discountFromList) }
					: discountFromList > 0
						? { discountPercent: discountFromList }
						: {}),
				netProfit,
				netMarginPercent,
				isWarningLoss: netProfit < 0
			};
		};

		return {
			list: buildSnapshot('list'),
			credit1Pay: buildSnapshot('credit1Pay'),
			debit: buildSnapshot('debit'),
			qr: buildSnapshot('qr'),
			transfer: buildSnapshot('transfer'),
			cash: buildSnapshot('cash')
		};
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

	/**
	 * Redondea un precio de lista o transferencia a la terminación psicológica más atractiva (.000, .500 o .900)
	 * Ejemplos:
	 * 34082 -> 34000
	 * 28384 -> 28500
	 * 74698 -> 74900
	 */
	public static roundCharmPrice(price: number): number {
		if (!price || price <= 0) return 0;
		const rounded100 = Math.round(price / 100) * 100;
		const remainder = rounded100 % 1000;

		if (remainder >= 700) {
			return Math.floor(rounded100 / 1000) * 1000 + 900;
		}
		if (remainder >= 300 && remainder <= 600) {
			return Math.floor(rounded100 / 1000) * 1000 + 500;
		}
		if (remainder < 300 && rounded100 >= 1000) {
			return Math.floor(rounded100 / 1000) * 1000;
		}
		return rounded100;
	}
}
