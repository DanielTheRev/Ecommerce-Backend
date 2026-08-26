export type PricingMethod = 'markup' | 'margin';

export interface IMetaPixelConfig {
	active: boolean;
	pixelId: string;
	accessToken: string;
	testEventCode?: string;
}

export interface IGoogleAnalyticsConfig {
	active: boolean;
	measurementId: string;
}

export interface IGoogleAuthConfig {
	active: boolean;
	clientId: string;
}

export interface IResendConfig {
	active: boolean;
	apiKey?: string;
	fromEmail?: string;
	fromName?: string;
}

export interface IEcommerceIntegrations {
	metaPixel?: IMetaPixelConfig;
	googleAnalytics?: IGoogleAnalyticsConfig;
	googleAuth?: IGoogleAuthConfig;
	resend?: IResendConfig;
}

export interface IPricingStrategy {
	/** 'markup' = sobre el costo (default), 'margin' = sobre el precio de venta */
	method: PricingMethod;
	/** Si true, el precio de transferencia incluye el gross-up de la comisión de pasarela (iguala con tarjeta 1 pago) */
	transferGrossUp: boolean;
	/** Si true, el vendedor absorbe el CFT de cuotas (cuotas sin interés). Si false, no ofrece cuotas. */
	absorbInstallments: boolean;
	/** Hasta cuántas cuotas absorbe el vendedor (ej. 3, 6, 12) */
	maxInstallmentsToAbsorb?: number;
	/** Porcentaje de descuento por pago con Transferencia (ej. 10 para 10%) */
	transferDiscountPercentage?: number;
	/** Porcentaje de descuento por pago en Efectivo (ej. 10 para 10%) */
	cashDiscountPercentage?: number;
}

export interface IRecommendationConfig {
	limit: number;
	rules: Record<string, string[]>;
}

export interface IEcommerceConfig {
	key: string;
	name?: string;
	logo?: string;
	/** @deprecated Usar profit1Pay / profitInstallments. Se mantiene como fallback. */
	profit: number;
	/** Margen global para contado / transferencia / débito / 1 pago */
	profit1Pay?: number;
	/** Margen global para cuotas */
	profitInstallments?: number;
	costCurrency?: 'USD' | 'ARS';
	dollarQuoteType?: 'oficial' | 'blue' | 'bolsa' | 'ccl' | 'tarjeta' | 'mayorista' | 'cripto' | 'custom';
	customDollarRate?: number;
	taxes: {
		iva: number;
	};
	firstPurchaseDiscount?: {
		enabled: boolean;
		percentage: number;
	};
	pricingStrategy: IPricingStrategy;
	paymentGateways: IEcommercePaymentGateway;
	integrations?: IEcommerceIntegrations;
	callbackURLs: {
		success: string;
		fail: string;
		notification: string;
	};
	contact?: {
		email: string;
		phone: string;
		address: string;
		whatsapp?: string;
	};
	social?: {
		instagram: string;
		facebook: string;
		twitter: string;
		tiktok: string;
	};
	brands: string[],
	categories: string[],
	clothingFits?: string[],
	shippingConfig?: {
		freeShippingThreshold: number;
	};
	workingHours?: IWorkingHoursConfig;
	recommendationConfig?: IRecommendationConfig;
}

export interface IEcommercePaymentGateway {
	uala: IEcommerceUalaPaymentGateway;
	mercadopago: IEcommerceMercadoPagoPaymentGateway;
	transfer?: IEcommerceTransferPaymentGateway;
}

export interface IEcommerceUalaPaymentGateway {
	active: boolean;
	credentials: IEcommerceUalaCredentials;
	baseCommission: number;
	cft3cuotas: number;
	cft6Cuotas: number;
}
export interface IEcommerceUalaCredentials {
	userName: string;
	clientId: string;
	clientSecret: string;
}

export interface IEcommerceMercadoPagoPaymentGateway {
	active: boolean;
	accessToken: string;
	publicKey: string;
	baseCommission: number;
	cft3cuotas: number;
	cft6Cuotas: number;
	maxInstallments: number;
	excludedPaymentMethods: string[];
	excludedPaymentTypes: string[];
	webhookSecret?: string;
}

export interface IEcommerceTransferPaymentGateway {
	active: boolean;
	alias: string;
	cbuCvu: string;
	bankName?: string;
	titular?: string;
}

export enum EcommercePaymentProviders {
	UALA = 'uala',
	MERCADOPAGO = 'mercadopago',
	TRANSFER = 'transfer'
}

export interface IWorkingHoursConfig {
	weekdayStart?: string; // e.g. "10:00"
	weekdayEnd?: string;   // e.g. "20:00"
	sundayStart?: string;  // e.g. "10:00"
	sundayEnd?: string;    // e.g. "15:00"
	noticeText?: string;   // e.g. "Lun a Sáb 10-20h / Dom 10-15h"
}

export interface IEcommerceConfigPublic {
	name?: string;
	logo?: string;
	contact: {
		email: string;
		phone: string;
		address: string;
		whatsapp?: string;
	};
	social: {
		instagram: string;
		facebook: string;
		twitter: string;
		tiktok: string;
	};
	brands: string[];
	categories: string[];
	clothingFits?: string[];
	shippingConfig?: {
		freeShippingThreshold: number;
	};
	workingHours?: IWorkingHoursConfig;
	/** El e-commerce necesita saber si se ofrecen cuotas sin interés */
	absorbInstallments: boolean;
	pricingStrategy?: {
		absorbInstallments: boolean;
		maxInstallmentsToAbsorb?: number;
		transferDiscountPercentage?: number;
		cashDiscountPercentage?: number;
	};
	integrations?: {
		metaPixel?: {
			active: boolean;
			pixelId: string;
		};
		googleAnalytics?: {
			active: boolean;
			measurementId: string;
		};
		googleAuth?: {
			active: boolean;
			clientId: string;
		};
		resend?: {
			active: boolean;
			fromEmail?: string;
			fromName?: string;
		};
	};
	paymentGateways: {
		mercadopago: {
			publicKey: string;
			maxInstallments: number;
			excludedPaymentMethods: string[];
			excludedPaymentTypes: string[];
		};
		transfer: {
			active: boolean;
			alias: string;
			cbuCvu: string;
			bankName?: string;
			titular?: string;
		};
	};
}
