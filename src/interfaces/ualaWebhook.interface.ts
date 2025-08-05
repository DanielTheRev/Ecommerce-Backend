export interface UalaWebhook {
	uuid: string;
	external_reference: string;
	status: UalaOrderStatus;
	created_date: string;
	api_version: string;
}

export enum UalaOrderStatus {
	Aprobado = 'APPROVED',
	Procesando = 'PROCESSED',
	Declinada = 'REJECTED'
}
