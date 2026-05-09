export interface IEcommerceConfig {
	key: string;
	name?: string;
	profit: number;
	costCurrency?: 'USD' | 'ARS';
	taxes: {
		iva: number;
	};
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
