import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders, IEcommerceConfig } from '@/interfaces/ecommerce.interface';
import { EcommerceConfig } from '@/models/Ecommerce.model';

export class EcommerceService {
	static seedDefaultConfig = async () => {
		try {
			const configExists = await EcommerceConfig.findOne({ key: 'global_config' });

			if (!configExists) {
				console.log('🌱 Creando configuración inicial del Ecommerce...');
				await EcommerceConfig.create();
				console.log('✅ Configuración inicial creada con éxito.');
			}
		} catch (error) {
			throw new Error('❌ Error al inicializar la configuración:');
		}
	};

	static getConfig = async (): Promise<IEcommerceConfig> => {
		try {
			const config = await EcommerceConfig.findOne({ key: 'global_config' }).lean();
			if (!config)
				throw new AppError(
					'Ecommerce config not found',
					'Configuración de ecommerce no encontrada',
					404
				);
			return config as IEcommerceConfig;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to fetch ecommerce config',
				'Error al obtener la configuración de ecommerce',
				500
			);
		}
	};

	static getCredentials = async (provider: EcommercePaymentProviders) => {
		try {
			const config = await this.getConfig();
			switch (provider) {
				case EcommercePaymentProviders.UALA:
					return config.paymentGateways.uala.credentials;
				case EcommercePaymentProviders.MERCADOPAGO:
					return config.paymentGateways.mercadopago;
				default:
					throw new AppError('Invalid payment provider', 'Proveedor de pago inválido', 400);
			}
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to get payment provider credentials',
				'Error al obtener las credenciales del proveedor de pago',
				500
			);
		}
	};

	static async getPaymentGateway(provider: EcommercePaymentProviders) {
		try {
			const config = await this.getConfig();
			const paymentGateways = {
				[EcommercePaymentProviders.UALA]: config.paymentGateways.uala,
				[EcommercePaymentProviders.MERCADOPAGO]: config.paymentGateways.mercadopago
			};
			const selectedProvider = paymentGateways[provider];
			if (!selectedProvider)
				throw new AppError(
					`Provider ${provider} not found`,
					'No se encontró proveedor de pago',
					404
				);
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to get payment provider credentials',
				'Error al obtener las credenciales del proveedor de pago',
				500
			);
		}
	}
}
