import { AppError } from '@/errors/app.error';
import {
	EcommercePaymentProviders,
	IEcommerceUalaCredentials
} from '@/interfaces/ecommerce.interface';
import { EcommerceService } from '@/services/ecommerce.service';
import { TenantModels } from '@/config/modelRegistry';
import UalaApiCheckout from 'ualabis-nodejs';

export async function initUalaCheckOut(models: TenantModels) {
	try {
		const credentials = (await EcommerceService.getCredentials(
			models,
			EcommercePaymentProviders.UALA
		)) as IEcommerceUalaCredentials;
		return await UalaApiCheckout.setUp({
			...credentials,
			isDev: false
		});
	} catch (error) {
		console.log(error);
		throw new AppError(
			'Failed to initialize Uala Checkout',
			'Error al inicializar Uala Checkout',
			500
		);
	}
}
