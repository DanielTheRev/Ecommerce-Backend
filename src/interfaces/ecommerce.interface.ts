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

export interface IEmailTemplateItem {
	enabled: boolean;
	subject: string;
	heading?: string;
	message: string;
	extraInstructions?: string;
	buttonText?: string;
	fromName?: string;
	fromEmail?: string;
	replyTo?: string;
}

export interface IEmailBrandingConfig {
	primaryColor?: string;
	footerText?: string;
	showSocialLinks?: boolean;
	showStoreLogo?: boolean;
}

export interface IEmailTemplatesConfig {
	branding?: IEmailBrandingConfig;
	orderConfirmation?: IEmailTemplateItem;
	bankTransfer?: IEmailTemplateItem;
	cashPayment?: IEmailTemplateItem;
	paymentReceived?: IEmailTemplateItem;
	paymentPending?: IEmailTemplateItem;
	orderShipped?: IEmailTemplateItem;
	orderDelivered?: IEmailTemplateItem;
	abandonedCart?: IEmailTemplateItem;
	backInStock?: IEmailTemplateItem;
}

export interface IAuthConfig {
	allowEmailPassword: boolean;
	allowMagicCode: boolean;
	allowGoogle: boolean;
	defaultMethod?: 'google' | 'magic_code' | 'password';
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
	/** Si true, el cliente que paga en 1 pago con tarjeta o débito paga el precio de oferta/transferencia. Si false (recomendado), paga el precio de lista. */
	card1PayDiscount?: boolean;
}

export interface IRecommendationConfig {
	limit: number;
	rules: Record<string, string[]>;
}

export interface IPOSConfig {
	/** 'fast_receipt' = permite cerrar venta con foto de comprobante, 'strict_admin_approval' = requiere aprobación admin en vivo */
	transferValidationMode: 'fast_receipt' | 'strict_admin_approval';
	allowManualDiscount?: boolean;
	autoPrintReceipt?: boolean;
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
	posConfig?: IPOSConfig;
	paymentGateways: IEcommercePaymentGateway;
	integrations?: IEcommerceIntegrations;
	authConfig?: IAuthConfig;
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
	emailTemplates?: IEmailTemplatesConfig;
}

export interface IEcommercePaymentGateway {
	uala?: IEcommerceUalaPaymentGateway;
	mercadopago: IEcommerceMercadoPagoPaymentGateway;
	getnet?: IEcommerceGetnetPaymentGateway;
	transfer?: IEcommerceTransferPaymentGateway;
}

export interface IEcommerceGetnetPaymentGateway {
	active: boolean;
	clientId: string;
	clientSecret: string;
	environment: 'sandbox' | 'production';
	baseCommission: number;
	cft3cuotas: number;
	cft6Cuotas: number;
	cft12cuotas?: number;
	maxInstallments: number;
	checkoutMode?: 'redirect' | 'modal' | 'iframe';
}

export interface IEcommerceUalaPaymentGateway {
	active: boolean;
	credentials: IEcommerceUalaCredentials;
	baseCommission: number;
	cft3cuotas: number;
	cft6Cuotas: number;
	cft12cuotas?: number;
	callbackSuccess?: string;
	callbackFail?: string;
	notificationUrl?: string;
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
	environment?: 'sandbox' | 'production';
	checkoutMode?: 'transparent' | 'redirect' | 'modal' | 'bricks' | 'pro' | 'api';
	baseCommission: number;
	cft3cuotas: number;
	cft6Cuotas: number;
	cft12cuotas?: number;
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
	GETNET = 'getnet',
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
	authConfig?: IAuthConfig;
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
			active: boolean;
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
