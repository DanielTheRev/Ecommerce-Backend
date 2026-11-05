export interface IPointDevice {
	id: string;
	name: string;
	operatingMode: 'PDV' | 'STANDALONE' | 'SELF_SERVICE' | string;
	posId?: string;
	storeId?: string;
	externalId?: string;
}

export interface ICreatePointOrderDTO {
	deviceId: string;
	amount: number;
	orderNumber?: string;
	description?: string;
	printOnTerminal?: boolean;
}

export interface IPointOrderResponse {
	orderId: string;
	status: 'created' | 'at_terminal' | 'processing' | 'processed' | 'failed' | 'cancelled' | string;
	deviceId: string;
	totalAmount: number;
	externalReference: string;
	createdAt?: string;
	paymentDetails?: {
		paymentId?: string;
		status?: string;
		paymentMethodId?: string;
		paymentTypeId?: string;
		cardLastFourDigits?: string;
	};
}
