import {
	IMercadoPagoSurfaceConfig,
	QrCreditSettlementTerm,
	QrDebitSettlementTerm,
	WebSettlementTerm
} from './priceBuilder.types';

/**
 * Tasas netas oficiales de Mercado Pago Argentina (sin IVA).
 * Al calcular precios, Vexx suma automáticamente el IVA configurado en taxes.iva (ej. 21%).
 */
export const MP_WEB_CHECKOUT_RATES: Record<WebSettlementTerm, number> = {
	instant: 6.60,
	'10d': 4.60,
	'18d': 3.55,
	'35d': 1.56
};

export const MP_DEFAULT_CFT = {
	cft2cuotas: 7.79,
	cft3cuotas: 10.49,
	cft6Cuotas: 18.69,
	cft9cuotas: 26.49,
	cft12cuotas: 32.29,
	cft18cuotas: 41.59
} as const;

export const MP_QR_RATES = {
	accountMoney: 0.80,
	debit: {
		instant: 1.41,
		'2d': 0.89
	} as Record<QrDebitSettlementTerm, number>,
	credit: {
		instant: 6.29,
		'10d': 4.40
	} as Record<QrCreditSettlementTerm, number>,
	prepaid: 3.93
} as const;

export const MP_POS_POINT_RATES = {
	debit: 3.14,
	credit: 6.29,
	prepaid: 3.93,
	pix: 3.40
} as const;

export interface IResolvedMpRates {
	webBasePercent: number;
	cft2Percent: number;
	cft3Percent: number;
	cft6Percent: number;
	cft9Percent: number;
	cft12Percent: number;
	cft18Percent: number;
	qrWorstPercent: number;
	qrAccountMoneyPercent: number;
	qrCreditPercent: number;
	qrDebitPercent: number;
	allowCardsInQr: boolean;
	posDebitPercent: number;
	webTerm: WebSettlementTerm;
}

function normalizeRatePercent(raw: number): number {
	if (!Number.isFinite(raw) || raw < 0) return 0;
	// Soporta valores históricos guardados como decimal (0.06 -> 6%); tasas como 0.80 ya están en %
	return raw > 0 && raw < 0.25 ? raw * 100 : raw;
}

/**
 * Resuelve las tasas netas (sin IVA) efectivas de Mercado Pago por superficie.
 * Si customRatesOverride === false, prevalecen las tablas oficiales del plazo seleccionado.
 */
export function resolveMpEffectiveRates(mp: IMercadoPagoSurfaceConfig): IResolvedMpRates {
	const override = Boolean(mp.customRatesOverride);
	const webTerm: WebSettlementTerm = mp.webCheckout?.settlementTerm || 'instant';
	const qrDebitTerm: QrDebitSettlementTerm = mp.qr?.debitTerm || 'instant';
	const qrCreditTerm: QrCreditSettlementTerm = mp.qr?.creditTerm || 'instant';

	const legacyBase = mp.baseCommission !== undefined ? normalizeRatePercent(mp.baseCommission) : undefined;
	const webBasePercent = override && mp.webCheckout?.baseCommission !== undefined
		? normalizeRatePercent(mp.webCheckout.baseCommission)
		: (MP_WEB_CHECKOUT_RATES[webTerm] ?? legacyBase ?? MP_WEB_CHECKOUT_RATES.instant);

	const cft2Percent = override && mp.webCheckout?.cft2cuotas !== undefined
		? normalizeRatePercent(mp.webCheckout.cft2cuotas)
		: (mp.webCheckout?.cft2cuotas ?? MP_DEFAULT_CFT.cft2cuotas);

	const cft3Percent = override && mp.webCheckout?.cft3cuotas !== undefined
		? normalizeRatePercent(mp.webCheckout.cft3cuotas)
		: (mp.cft3cuotas ?? mp.webCheckout?.cft3cuotas ?? MP_DEFAULT_CFT.cft3cuotas);

	const cft6Percent = override && mp.webCheckout?.cft6Cuotas !== undefined
		? normalizeRatePercent(mp.webCheckout.cft6Cuotas)
		: (mp.cft6Cuotas ?? mp.webCheckout?.cft6Cuotas ?? MP_DEFAULT_CFT.cft6Cuotas);

	const cft9Percent = override && mp.webCheckout?.cft9cuotas !== undefined
		? normalizeRatePercent(mp.webCheckout.cft9cuotas)
		: (mp.webCheckout?.cft9cuotas ?? MP_DEFAULT_CFT.cft9cuotas);

	const cft12Percent = override && mp.webCheckout?.cft12cuotas !== undefined
		? normalizeRatePercent(mp.webCheckout.cft12cuotas)
		: normalizeRatePercent(mp.cft12cuotas ?? mp.webCheckout?.cft12cuotas ?? MP_DEFAULT_CFT.cft12cuotas);

	const cft18Percent = override && mp.webCheckout?.cft18cuotas !== undefined
		? normalizeRatePercent(mp.webCheckout.cft18cuotas)
		: (mp.webCheckout?.cft18cuotas ?? MP_DEFAULT_CFT.cft18cuotas);

	const allowCardsInQr = mp.qr?.allowCardsInQr === true;
	const qrAccountMoneyPercent = override && mp.qr?.accountMoneyCommission !== undefined
		? normalizeRatePercent(mp.qr.accountMoneyCommission)
		: MP_QR_RATES.accountMoney;
	const qrDebitPercent = override && mp.qr?.debitCommission !== undefined
		? normalizeRatePercent(mp.qr.debitCommission)
		: (MP_QR_RATES.debit[qrDebitTerm] ?? MP_QR_RATES.debit.instant);
	const qrCreditPercent = override && mp.qr?.creditCommission !== undefined
		? normalizeRatePercent(mp.qr.creditCommission)
		: (MP_QR_RATES.credit[qrCreditTerm] ?? MP_QR_RATES.credit.instant);

	const qrWorstPercent = allowCardsInQr ? qrCreditPercent : qrAccountMoneyPercent;

	const posDebitPercent = override && mp.posPoint?.debitCommission !== undefined
		? normalizeRatePercent(mp.posPoint.debitCommission)
		: (mp.debitCommission !== undefined && mp.debitCommission > 0
			? normalizeRatePercent(mp.debitCommission)
			: MP_POS_POINT_RATES.debit);

	return {
		webBasePercent,
		cft2Percent,
		cft3Percent,
		cft6Percent,
		cft9Percent,
		cft12Percent,
		cft18Percent,
		qrWorstPercent,
		qrAccountMoneyPercent,
		qrCreditPercent,
		qrDebitPercent,
		allowCardsInQr,
		posDebitPercent,
		webTerm
	};
}
