export type PricingMethod = 'markup' | 'margin';

export interface IPricingStrategy {
	/** 'markup' = sobre el costo (default), 'margin' = sobre el precio de venta */
	method: PricingMethod;
	/** Si true, el precio de transferencia incluye el gross-up de la comisión de pasarela (iguala con tarjeta 1 pago) */
	transferGrossUp: boolean;
	/** Si true, el vendedor absorbe el CFT de cuotas (cuotas sin interés). Si false, no ofrece cuotas. */
	absorbInstallments: boolean;
}

export interface IEcommerceConfig {
	key: string;
	name?: string;
	/** @deprecated Usar profit1Pay / profitInstallments. Se mantiene como fallback. */
	profit: number;
	/** Margen global para contado / transferencia / débito / 1 pago */
	profit1Pay?: number;
	/** Margen global para cuotas */
	profitInstallments?: number;
	costCurrency?: 'USD' | 'ARS';
	taxes: {
		iva: number;
	};
	pricingStrategy?: IPricingStrategy;
	paymentGateways: IEcommercePaymentGateway;
	callbackURLs: {
		success: string;
		fail: string;
		notification: string;
	};
	contact?: {
		email: string;
		phone: string;
		address: string;
	};
	social?: {
		instagram: string;
		facebook: string;
		twitter: string;
		tiktok: string;
	};
	brands: string[],
	categories: string[],
	shippingConfig?: {
		freeShippingThreshold: number;
	}
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
}

export enum EcommercePaymentProviders {
	UALA = 'uala',
	MERCADOPAGO = 'mercadopago',
	TRANSFER = 'transfer'
}

export interface IEcommerceConfigPublic {
	contact: {
		email: string;
		phone: string;
		address: string;
	};
	social: {
		instagram: string;
		facebook: string;
		twitter: string;
		tiktok: string;
	};
	brands: string[];
	categories: string[];
	shippingConfig?: {
		freeShippingThreshold: number;
	};
	/** El e-commerce necesita saber si se ofrecen cuotas sin interés */
	absorbInstallments: boolean;
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
		};
	};
}
