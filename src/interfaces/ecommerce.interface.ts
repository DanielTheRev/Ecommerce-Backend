export interface IEcommerceConfig {
	key: string;
	profit: number;
	taxes: {
		iva: number;
	};
	paymentGateways: IEcommercePaymentGateway;
	callbackURLs: {
		success: string;
		fail: string;
		notification: string;
	};
}

export interface IEcommercePaymentGateway {
	uala: IEcommerceUalaPaymentGateway;
	mercadopago: IEcommerceMercadoPagoPaymentGateway;
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
}

export enum EcommercePaymentProviders {
	UALA = 'uala',
	MERCADOPAGO = 'mercadopago'
}
