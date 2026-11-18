import { AppError } from '@/errors/app.error';
import { PriceRoundingMode, PricingMethod } from '@/interfaces/ecommerce.interface';
import { ICostConcept } from '@/interfaces/product.interface';
import { resolveMpEffectiveRates } from './mpRates.catalog';
import {
	ChannelKey,
	ChannelSurface,
	IDisplaySummaryItem,
	IPriceBuilderCalculateInput,
	IPriceBuilderCalculateResult,
	IPriceBuilderChannelPricing,
	IPriceBuilderChannelRule,
	IPriceBuilderChannelSnapshot,
	IPriceBuilderInsight,
	PricingPresetKey
} from './priceBuilder.types';

const CHANNEL_ORDER: ChannelKey[] = ['cash', 'transfer', 'qr', 'debit', 'credit1Pay', 'list'];

const CHANNEL_LABELS: Record<ChannelKey, { title: string; short: string; surface: ChannelSurface }> = {
	cash: { title: 'Efectivo', short: 'Efectivo', surface: 'pos' },
	transfer: { title: 'Transferencia', short: 'Transferencia', surface: 'all' },
	qr: { title: 'Código QR', short: 'QR', surface: 'pos' },
	debit: { title: 'Tarjeta Débito', short: 'Débito', surface: 'pos' },
	credit1Pay: { title: 'Crédito 1 Pago', short: 'Crédito 1 Pago', surface: 'all' },
	list: { title: 'Precio de Lista', short: 'Lista', surface: 'web' }
};

function resolveRoundingStep(n: number, mode: PriceRoundingMode): number {
	if (mode === 'auto') {
		if (n < 2000) return 10;
		if (n < 10000) return 50;
		if (n < 50000) return 100;
		return 500;
	}
	const numeric = Number(mode);
	return Number.isFinite(numeric) && numeric > 0 ? numeric : 100;
}

function roundCharmPrice(n: number, mode: PriceRoundingMode = '100'): number {
	if (!Number.isFinite(n) || n <= 0) return 0;
	if (mode === 'exact') return Math.round(n);
	const step = resolveRoundingStep(n, mode);
	return Math.round(n / step) * step;
}

function normalizePercent(raw: number): number {
	if (!Number.isFinite(raw) || raw < 0) return 0;
	// Valores históricos en decimal (ej. 0.035 -> 3.5%, 0.06 -> 6%). Tasas como 0.80 ya están en %.
	return raw > 0 && raw < 0.25 ? raw * 100 : raw;
}

interface ResolvedGatewayContext {
	key: string;
	label: string;
	hasCardGateway: boolean;
	webTermLabel: string;
	tasa1Factor: number;
	tasa2Factor: number;
	tasa3Factor: number;
	tasa6Factor: number;
	tasa9Factor: number;
	tasa12Factor: number;
	tasa18Factor: number;
	qrWorstFactor: number;
	debitFactor: number;
	allowCardsInQr: boolean;
	qrAccountPercent: number;
	qrCreditPercent: number;
	webBasePercent: number;
	posDebitPercent: number;
	absorbInstallments: boolean;
	maxInstallmentsToAbsorb: number;
}

function resolveGatewayContext(config: any, ivaFactor: number): ResolvedGatewayContext {
	const gateways = config?.paymentGateways || {};
	const preferred: string | undefined = gateways.defaultWebGateway || gateways.defaultGateway;

	const isMpActive = Boolean(gateways.mercadopago?.active);
	const isGetnetActive = Boolean(gateways.getnet?.active);
	const isUalaActive = Boolean(gateways.uala?.active);

	if (preferred) {
		const isPreferredActive =
			(preferred === 'mercadopago' && isMpActive) ||
			(preferred === 'getnet' && isGetnetActive) ||
			(preferred === 'uala' && isUalaActive);
		if (!isPreferredActive) {
			throw new AppError(
				'Default gateway inactive',
				`La pasarela por defecto '${preferred}' no se encuentra activa en Cobros y Pagos.`,
				400
			);
		}
	}

	const selectedKey = preferred || (isMpActive ? 'mercadopago' : isGetnetActive ? 'getnet' : isUalaActive ? 'uala' : 'none');
	const absorbInstallments = Boolean(config?.pricingStrategy?.absorbInstallments);
	const maxInstallmentsToAbsorb = Number(config?.pricingStrategy?.maxInstallmentsToAbsorb || 1);

	if (selectedKey === 'mercadopago') {
		const mp = gateways.mercadopago;
		const r = resolveMpEffectiveRates(mp);
		return {
			key: 'mercadopago',
			label: 'Mercado Pago',
			hasCardGateway: true,
			webTermLabel: r.webTerm,
			tasa1Factor: (r.webBasePercent / 100) * ivaFactor,
			tasa2Factor: ((r.webBasePercent + r.cft2Percent) / 100) * ivaFactor,
			tasa3Factor: ((r.webBasePercent + r.cft3Percent) / 100) * ivaFactor,
			tasa6Factor: ((r.webBasePercent + r.cft6Percent) / 100) * ivaFactor,
			tasa9Factor: ((r.webBasePercent + r.cft9Percent) / 100) * ivaFactor,
			tasa12Factor: ((r.webBasePercent + r.cft12Percent) / 100) * ivaFactor,
			tasa18Factor: ((r.webBasePercent + r.cft18Percent) / 100) * ivaFactor,
			qrWorstFactor: (r.qrWorstPercent / 100) * ivaFactor,
			debitFactor: (r.posDebitPercent / 100) * ivaFactor,
			allowCardsInQr: r.allowCardsInQr,
			qrAccountPercent: r.qrAccountMoneyPercent,
			qrCreditPercent: r.qrCreditPercent,
			webBasePercent: r.webBasePercent,
			posDebitPercent: r.posDebitPercent,
			absorbInstallments,
			maxInstallmentsToAbsorb
		};
	}

	if (selectedKey === 'getnet' || selectedKey === 'uala') {
		const gw = gateways[selectedKey];
		const base = normalizePercent(Number(gw.baseCommission || 0));
		const cft3 = normalizePercent(Number(gw.cft3cuotas || 0));
		const cft6 = normalizePercent(Number(gw.cft6Cuotas || 0));
		const qr = normalizePercent(Number(gw.qrCommission || 0));
		const debit = normalizePercent(Number(gw.debitCommission || 0));
		return {
			key: selectedKey,
			label: selectedKey === 'getnet' ? 'Getnet' : 'Ualá Bis',
			hasCardGateway: true,
			webTermLabel: 'standard',
			tasa1Factor: (base / 100) * ivaFactor,
			tasa2Factor: ((base + cft3) / 100) * ivaFactor,
			tasa3Factor: ((base + cft3) / 100) * ivaFactor,
			tasa6Factor: ((base + cft6) / 100) * ivaFactor,
			tasa9Factor: ((base + cft6) / 100) * ivaFactor,
			tasa12Factor: ((base + cft6) / 100) * ivaFactor,
			tasa18Factor: ((base + cft6) / 100) * ivaFactor,
			qrWorstFactor: (qr / 100) * ivaFactor,
			debitFactor: (debit / 100) * ivaFactor,
			allowCardsInQr: true,
			qrAccountPercent: qr,
			qrCreditPercent: qr,
			webBasePercent: base,
			posDebitPercent: debit,
			absorbInstallments,
			maxInstallmentsToAbsorb
		};
	}

	// Comercio sin pasarela de tarjeta activa (ej. Kiosco solo Efectivo / Transferencia)
	return {
		key: 'none',
		label: 'Sin pasarela de tarjeta',
		hasCardGateway: false,
		webTermLabel: 'none',
		tasa1Factor: 0,
		tasa2Factor: 0,
		tasa3Factor: 0,
		tasa6Factor: 0,
		tasa9Factor: 0,
		tasa12Factor: 0,
		tasa18Factor: 0,
		qrWorstFactor: 0,
		debitFactor: 0,
		allowCardsInQr: false,
		qrAccountPercent: 0,
		qrCreditPercent: 0,
		webBasePercent: 0,
		posDebitPercent: 0,
		absorbInstallments: false,
		maxInstallmentsToAbsorb: 1
	};
}

export function buildPresetChannelPricing(preset: PricingPresetKey): Record<ChannelKey, IPriceBuilderChannelRule> {
	const baseRule = (overrides: Partial<IPriceBuilderChannelRule>): IPriceBuilderChannelRule => ({
		enabled: true,
		mode: 'auto',
		inheritCosts: true,
		...overrides
	});

	if (preset === '2_prices') {
		return {
			cash: baseRule({ mode: 'linked', linkedTo: 'qr' }),
			transfer: baseRule({ mode: 'linked', linkedTo: 'qr' }),
			qr: baseRule({ mode: 'auto' }),
			debit: baseRule({ enabled: false }),
			credit1Pay: baseRule({ enabled: false }),
			list: baseRule({ mode: 'auto' })
		};
	}

	if (preset === '3_prices') {
		return {
			cash: baseRule({ mode: 'linked', linkedTo: 'qr' }),
			transfer: baseRule({ mode: 'linked', linkedTo: 'qr' }),
			qr: baseRule({ mode: 'auto' }),
			debit: baseRule({ mode: 'linked', linkedTo: 'credit1Pay' }),
			credit1Pay: baseRule({ mode: 'auto' }),
			list: baseRule({ mode: 'auto' })
		};
	}

	return {
		cash: baseRule({ mode: 'auto', inheritCosts: false, excludedCostConcepts: ['IIBB Provincia'], extraCosts: [] }),
		transfer: baseRule({ mode: 'auto' }),
		qr: baseRule({ mode: 'auto' }),
		debit: baseRule({ mode: 'auto' }),
		credit1Pay: baseRule({ mode: 'auto' }),
		list: baseRule({ mode: 'auto' })
	};
}

export class PriceBuilderEngine {
	static calculate(input: IPriceBuilderCalculateInput): IPriceBuilderCalculateResult {
		const { config } = input;
		if (!config) {
			throw new AppError('Config required', 'Falta la configuración financiera del comercio (EcommerceConfig).', 500);
		}

		const costCurrency: 'USD' | 'ARS' = config.costCurrency || 'ARS';
		const dolar = Number(input.dolar) > 0 ? Number(input.dolar) : 1;
		const rawCost = Number(input.providerCost);
		if (!Number.isFinite(rawCost) || rawCost < 0) {
			throw new AppError('Invalid providerCost', 'El costo de proveedor debe ser un número válido >= 0.', 400);
		}
		const providerCostInARS = costCurrency === 'USD' ? rawCost * dolar : rawCost;

		const method: PricingMethod = input.pricingMethodChoice || config.pricingStrategy?.method || 'markup';
		const roundingMode: PriceRoundingMode = input.priceRoundingMode || config.pricingStrategy?.priceRoundingMode || '100';
		const profitMargin = input.useCustomProfit && input.customProfitMargin !== undefined
			? Number(input.customProfitMargin)
			: Number(input.customProfitMargin ?? config.pricingStrategy?.defaultProfitMargin ?? 50);
		const profitFactor = profitMargin / 100;

		const ivaPercent = Number(config.taxes?.iva ?? 21);
		const ivaFactor = 1 + ivaPercent / 100;
		const gw = resolveGatewayContext(config, ivaFactor);

		const allowCardPayment = input.paymentRestrictions?.allowCardPayment !== false;
		const allowInterestFreeInstallments = input.paymentRestrictions?.allowInterestFreeInstallments !== false;
		const storeMaxInst = gw.hasCardGateway && gw.absorbInstallments ? gw.maxInstallmentsToAbsorb : 1;
		const requestedMaxInst = input.paymentRestrictions?.maxInstallments;

		if (
			requestedMaxInst !== undefined &&
			gw.hasCardGateway &&
			gw.absorbInstallments &&
			requestedMaxInst > storeMaxInst
		) {
			throw new AppError(
				'Invalid installment cap',
				`No podés ofrecer ${requestedMaxInst} cuotas sin interés en este producto porque tu tienda absorbe hasta ${storeMaxInst} en Cobros y Pagos.`,
				400
			);
		}

		const candidateMaxInst = requestedMaxInst !== undefined
			? Math.max(1, requestedMaxInst)
			: storeMaxInst;
		const effectiveAbsorb = gw.hasCardGateway && allowCardPayment && allowInterestFreeInstallments && gw.absorbInstallments && candidateMaxInst >= 2;
		const effectiveMaxInst = effectiveAbsorb ? candidateMaxInst : 1;

		let worstCaseTasa = allowCardPayment && gw.hasCardGateway ? gw.tasa1Factor : 0;
		if (effectiveAbsorb) {
			const installmentTierTasas: Array<[number, number]> = [
				[18, gw.tasa18Factor],
				[12, gw.tasa12Factor],
				[9, gw.tasa9Factor],
				[6, gw.tasa6Factor],
				[3, gw.tasa3Factor],
				[2, gw.tasa2Factor]
			];
			const matchedTier = installmentTierTasas.find(([minInstallments]) => effectiveMaxInst >= minInstallments);
			if (matchedTier) worstCaseTasa = matchedTier[1];
		}

		const feeMap: Record<ChannelKey, number> = {
			cash: 0,
			transfer: 0,
			qr: gw.qrWorstFactor,
			debit: gw.debitFactor,
			credit1Pay: gw.tasa1Factor,
			list: worstCaseTasa
		};

		const defaultEnabled: ChannelKey[] = Array.isArray(config.defaultEnabledChannels) && config.defaultEnabledChannels.length > 0
			? config.defaultEnabledChannels
			: CHANNEL_ORDER;

		const baseAdditionalCosts: ICostConcept[] = Array.isArray(input.additionalCosts)
			? input.additionalCosts
			: (Array.isArray(config?.defaultAdditionalCosts) ? config.defaultAdditionalCosts : []);
		const incomingRules: IPriceBuilderChannelPricing = input.channelPricing || {};
		const rules: Record<ChannelKey, IPriceBuilderChannelRule> = {} as Record<ChannelKey, IPriceBuilderChannelRule>;
		for (const k of CHANNEL_ORDER) {
			const r = incomingRules[k];
			rules[k] = {
				enabled: r?.enabled !== undefined ? Boolean(r.enabled) : defaultEnabled.includes(k),
				mode: r?.mode || 'auto',
				linkedTo: r?.linkedTo,
				discountPercent: r?.discountPercent,
				fixedPrice: r?.fixedPrice,
				inheritCosts: r?.inheritCosts !== undefined ? Boolean(r.inheritCosts) : true,
				excludedCostConcepts: Array.isArray(r?.excludedCostConcepts) ? r.excludedCostConcepts : [],
				extraCosts: Array.isArray(r?.extraCosts) ? r.extraCosts : []
			};
		}

		const getChannelCostProfile = (chKey: ChannelKey): { costInARS: number; taxFactor: number } => {
			const rule = rules[chKey];
			const excluded = new Set(rule.excludedCostConcepts || []);
			const baseList = rule.inheritCosts
				? baseAdditionalCosts
				: baseAdditionalCosts.filter((c) => !excluded.has(c.concept));
			const combined = rule.inheritCosts ? baseList : [...baseList, ...(rule.extraCosts || [])];

			let extraARS = 0;
			let taxFactor = 0;
			for (const c of combined) {
				const val = Number(c.value) || 0;
				const inARS = c.type === 'fixed' && costCurrency === 'USD' ? val * dolar : val;
				if (c.type === 'fixed') extraARS += inARS;
				else if (c.type === 'percent_over_provider') extraARS += providerCostInARS * (val / 100);
				else if (c.type === 'percent_over_price') taxFactor += val / 100;
			}
			return { costInARS: providerCostInARS + extraARS, taxFactor };
		};

		const calcTarget = (feeFactor: number, chKey: ChannelKey): number => {
			const { costInARS, taxFactor } = getChannelCostProfile(chKey);
			const denom = Math.max(0.05, 1 - feeFactor - taxFactor - (method === 'margin' ? profitFactor : 0));
			const raw = method === 'margin' ? costInARS / denom : (costInARS * (1 + profitFactor)) / denom;
			return roundCharmPrice(raw, roundingMode);
		};

		const autoListPrice = calcTarget(worstCaseTasa, 'list');
		const listPrice = rules.list.mode === 'fixed' && rules.list.fixedPrice !== undefined
			? Math.round(Number(rules.list.fixedPrice) || 0)
			: autoListPrice;

		const resolved: Partial<Record<ChannelKey, number>> = { list: listPrice };
		const resolveChannel = (key: ChannelKey, visiting = new Set<ChannelKey>()): number => {
			if (resolved[key] !== undefined) return resolved[key]!;
			if (visiting.has(key)) return calcTarget(0, key);
			visiting.add(key);

			const rule = rules[key];
			let val: number;
			if (rule.mode === 'linked' && rule.linkedTo) {
				val = resolveChannel(rule.linkedTo, visiting);
			} else if (rule.mode === 'fixed' && rule.fixedPrice !== undefined) {
				val = Math.round(Number(rule.fixedPrice) || 0);
			} else if (rule.mode === 'discount_from_list') {
				val = roundCharmPrice(listPrice * (1 - (Number(rule.discountPercent) || 0) / 100), roundingMode);
			} else {
				val = calcTarget(feeMap[key] || 0, key);
			}
			resolved[key] = val;
			return val;
		};

		const feeLabels: Record<ChannelKey, string> = {
			cash: 'Comisión pasarela: 0%',
			transfer: 'Comisión pasarela: 0%',
			qr: gw.hasCardGateway
				? (gw.key === 'mercadopago'
					? (gw.allowCardsInQr
						? `Comisión ${gw.label} QR (hasta Crédito): ${gw.qrCreditPercent.toFixed(2)}% + IVA = ${(gw.qrWorstFactor * 100).toFixed(2)}%`
						: `Comisión ${gw.label} QR (Dinero en MP): ${gw.qrAccountPercent.toFixed(2)}% + IVA = ${(gw.qrWorstFactor * 100).toFixed(2)}%`)
					: `Comisión ${gw.label} QR: ${gw.qrAccountPercent.toFixed(2)}% + IVA = ${(gw.qrWorstFactor * 100).toFixed(2)}%`)
				: 'Sin pasarela QR configurada: 0%',
			debit: gw.hasCardGateway
				? `Comisión Point Débito: ${gw.posDebitPercent.toFixed(2)}% + IVA = ${(gw.debitFactor * 100).toFixed(2)}%`
				: 'Sin pasarela de tarjeta: 0%',
			credit1Pay: gw.hasCardGateway
				? `Comisión Web 1 Pago: ${gw.webBasePercent.toFixed(2)}% + IVA = ${(gw.tasa1Factor * 100).toFixed(2)}%`
				: 'Sin pasarela de tarjeta: 0%',
			list: gw.hasCardGateway
				? (effectiveAbsorb
					? `Comisión + ${effectiveMaxInst}x s/i: ${(worstCaseTasa * 100).toFixed(2)}% c/IVA`
					: `Sin cuotas s/i (1 Pago): ${(worstCaseTasa * 100).toFixed(2)}% c/IVA`)
				: 'Sin pasarela de tarjeta: 0%'
		};

		const channels = {} as Record<ChannelKey, IPriceBuilderChannelSnapshot>;
		for (const k of CHANNEL_ORDER) {
			const p = resolveChannel(k);
			const { costInARS: chCost, taxFactor: chTaxFactor } = getChannelCostProfile(k);
			const netProfit = Math.round(p - chCost - p * feeMap[k] - p * chTaxFactor);
			const netMarginPercent = p > 0 ? Math.round((netProfit / p) * 1000) / 10 : 0;
			const targetProfitARS = method === 'margin' ? p * profitFactor : chCost * profitFactor;

			const isCardBlocked = !allowCardPayment && (k === 'debit' || k === 'credit1Pay' || k === 'list');
			channels[k] = {
				enabled: rules[k].enabled && !isCardBlocked,
				price: p,
				mode: rules[k].mode,
				inheritCosts: rules[k].inheritCosts,
				...(rules[k].mode === 'linked' && rules[k].linkedTo ? { linkedTo: rules[k].linkedTo } : {}),
				...(rules[k].mode === 'discount_from_list' ? { discountPercent: Number(rules[k].discountPercent) || 0 } : {}),
				...(!rules[k].inheritCosts ? {
					excludedCostConcepts: rules[k].excludedCostConcepts,
					extraCosts: rules[k].extraCosts
				} : {}),
				costBaseARS: Math.round(chCost),
				feeLabel: feeLabels[k],
				netProfit,
				netMarginPercent,
				isWarningLoss: netProfit < 0,
				isBelowTargetMargin: netProfit >= 0 && netProfit < targetProfitARS * 0.92,
				surface: CHANNEL_LABELS[k].surface
			};
		}

		// Insights accionables
		const insights: IPriceBuilderInsight[] = [];
		const maxSafeDiscount = Math.round(worstCaseTasa * 100);
		if (!allowCardPayment) {
			insights.push({
				type: 'info',
				code: 'CASH_ONLY_PRODUCT',
				message: 'Producto configurado como SOLO EFECTIVO / TRANSFERENCIA / QR (tarjeta bloqueada en checkout).'
			});
		} else if (effectiveAbsorb) {
			insights.push({
				type: 'info',
				code: 'INSTALLMENTS_ABSORBED',
				message: `Con ${gw.label} (${gw.webTermLabel}), absorbés hasta ${effectiveMaxInst} cuotas sin interés. Descuento máximo seguro en Efectivo/Transferencia: ${maxSafeDiscount}% OFF.`
			});
		} else if (gw.hasCardGateway) {
			insights.push({
				type: 'info',
				code: 'INSTALLMENTS_DISABLED',
				message: 'Cuotas sin interés desactivadas para este producto/tienda: el Precio de Lista coincide con 1 Pago Crédito.'
			});
		}

		for (const k of ['qr', 'debit', 'credit1Pay'] as ChannelKey[]) {
			const rule = rules[k];
			if (
				channels[k].enabled &&
				rule.mode === 'linked' &&
				rule.linkedTo &&
				feeMap[k] > (feeMap[rule.linkedTo] || 0) &&
				(channels[k].isBelowTargetMargin || channels[k].isWarningLoss)
			) {
				const protectedPrice = calcTarget(feeMap[k], k);
				const diff = Math.max(0, protectedPrice - channels[k].price);
				insights.push({
					type: 'warning',
					code: 'LINKED_CHANNEL_FEE_EAT',
					message: `${CHANNEL_LABELS[k].title} está igualado a ${CHANNEL_LABELS[rule.linkedTo].title} y te come ganancia (${(feeMap[k] * 100).toFixed(2)}% de comisión).`,
					suggestedFix: {
						label: `Proteger con tasa de ${CHANNEL_LABELS[k].title} (+$${diff.toLocaleString('es-AR')})`,
						expensiveCh: k,
						cheapCh: rule.linkedTo,
						suggestedPrice: protectedPrice
					}
				});
			}
		}

		for (const k of CHANNEL_ORDER) {
			if (channels[k].enabled && channels[k].isWarningLoss) {
				insights.push({
					type: 'warning',
					code: 'CHANNEL_NET_LOSS',
					message: `Pérdida neta en ${CHANNEL_LABELS[k].title}: perdés $${Math.abs(channels[k].netProfit).toLocaleString('es-AR')} por venta.`
				});
			}
		}

		const shippingConcept = baseAdditionalCosts.find(
			(c) => c.category === 'shipping' || /env[ií]o/i.test(c.concept || '')
		);
		const shippingSubsidy = shippingConcept ? Number(shippingConcept.value) || 0 : 0;
		if (shippingConcept && shippingSubsidy > 0) {
			const threshold = Number(config.shippingConfig?.freeShippingThreshold || 80000);
			insights.push({
				type: 'info',
				code: 'SHIPPING_SUBSIDY_INFO',
				message: `Subsidio de envío activo ($${shippingSubsidy.toLocaleString('es-AR')}): este importe se suma al costo del producto y se descuenta del envío al comprador en el carrito cuando no supera el umbral de envío gratis ($${threshold.toLocaleString('es-AR')}).`
			});
		}

		// Mapeo final de vidriera (agrupado por precio único entre canales activos)
		const displayGroups = new Map<number, { price: number; channels: ChannelKey[]; labels: string[]; surfaces: Set<ChannelSurface> }>();
		for (const k of CHANNEL_ORDER) {
			const snap = channels[k];
			if (!snap.enabled) continue;
			if (!displayGroups.has(snap.price)) {
				displayGroups.set(snap.price, { price: snap.price, channels: [], labels: [], surfaces: new Set() });
			}
			const g = displayGroups.get(snap.price)!;
			g.channels.push(k);
			g.labels.push(k === 'list' && effectiveAbsorb ? `${effectiveMaxInst} cuotas s/i` : CHANNEL_LABELS[k].short);
			g.surfaces.add(snap.surface);
		}
		const displaySummary: IDisplaySummaryItem[] = Array.from(displayGroups.values()).map((g) => ({
			label: g.labels.join(' / '),
			price: g.price,
			channels: g.channels,
			surface: g.surfaces.has('all') || (g.surfaces.has('web') && g.surfaces.has('pos'))
				? 'all'
				: Array.from(g.surfaces)[0] || 'all'
		}));

		const hasThreeSeamless = effectiveAbsorb && effectiveMaxInst >= 3;
		const hasSixSeamless = effectiveAbsorb && effectiveMaxInst >= 6;
		const transferDiscountPct = listPrice > 0
			? Math.max(0, Math.round(((listPrice - channels.transfer.price) / listPrice) * 100))
			: 0;

		return {
			activeGateway: { key: gw.key, label: gw.label },
			price: {
				listPrice,
				card_ticket1PayPrice: channels.credit1Pay.price,
				cashTransferPrice: channels.transfer.price,
				cashPrice: channels.cash.price,
				transferPrice: channels.transfer.price,
				qrPrice: channels.qr.price,
				debitPrice: channels.debit.price,
				shippingSubsidy,
				channels,
				displaySummary,
				updatedAt: new Date(),
				installments: {
					threePaymentsAmount: hasThreeSeamless ? Math.round(listPrice / 3) : 0,
					sixPaymentsAmount: hasSixSeamless ? Math.round(listPrice / 6) : 0,
					hasThreeInstallmentsSeamless: hasThreeSeamless,
					hasSixInstallmentsSeamless: hasSixSeamless
				}
			},
			finance: {
				exchangeRateSnapshot: Number(input.dolar || 1),
				mpCommissionSnapshot: {
					base: gw.webBasePercent,
					cft3Cuotas: Math.round(((gw.tasa3Factor / ivaFactor) * 100 - gw.webBasePercent) * 100) / 100,
					cft6Cuotas: Math.round(((gw.tasa6Factor / ivaFactor) * 100 - gw.webBasePercent) * 100) / 100
				},
				providerCost: {
					inUSD: costCurrency === 'USD' ? rawCost : Math.round((providerCostInARS / Math.max(1, Number(input.dolar || 1))) * 100) / 100,
					inARS: providerCostInARS
				},
				additionalCosts: baseAdditionalCosts,
				pricingStrategy: {
					method,
					targetProfit: profitMargin
				},
				calculatedProfits: {
					cash: channels.cash.netProfit,
					transfer: channels.transfer.netProfit,
					qr: channels.qr.netProfit,
					debit: channels.debit.netProfit,
					card_ticket1Pay: channels.credit1Pay.netProfit,
					card3Installments: Math.round(channels.list.price * (1 - gw.tasa3Factor - getChannelCostProfile('list').taxFactor) - channels.list.costBaseARS),
					card6Installments: Math.round(channels.list.price * (1 - gw.tasa6Factor - getChannelCostProfile('list').taxFactor) - channels.list.costBaseARS)
				},
				maxSafeDiscount
			},
			insights
		};
	}
}
