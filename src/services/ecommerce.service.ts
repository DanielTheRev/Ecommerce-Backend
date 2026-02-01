import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders, IEcommerceConfig } from '@/interfaces/ecommerce.interface';
import { EcommerceConfig } from '@/models/Ecommerce.model';
import { decrypt, encrypt } from '@/utils/encryption';

export class EcommerceService {
	private constructor() { }

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

			const decryptConfig = this.decryptEcommerceConfig(config as IEcommerceConfig);
			return decryptConfig;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to fetch ecommerce config',
				'Error al obtener la configuración de ecommerce',
				500
			);
		}
	};

	static createConfig = async (data: IEcommerceConfig, userId?: string): Promise<IEcommerceConfig> => {
		try {
			const existingConfig = await EcommerceConfig.findOne({ key: 'global_config' });
			if (existingConfig) {
				throw new AppError('Config already exists', 'La configuración ya existe. Use PUT para actualizar.', 400);
			}

			// Encriptar credenciales
			this.encryptEcommerceConfig(data);

			// Asignar key y usuario
			data.key = 'global_config';
			if (userId) {
				// @ts-ignore
				data.lastModifiedBy = userId;
			}

			const newConfig = await EcommerceConfig.create(data);
			
			// Devolvemos la config desencriptada para que el front la vea correctamente si es necesario
			// O podemos devolver newConfig directamente si preferimos que se vea encriptado (generalmente create retorna lo creado)
			// Para consistencia con getConfig, retornamos el objeto ya procesado (aunque create retorna mongoose doc)
			return this.decryptEcommerceConfig(newConfig.toObject() as IEcommerceConfig);
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to create ecommerce config',
				'Error al crear la configuración de ecommerce',
				500
			);
		}
	};

	static updateConfig = async (data: IEcommerceConfig, userId?: string): Promise<IEcommerceConfig> => {
		try {
			// Encriptar credenciales
			// IMPORTANTE: El frontend debe enviar las credenciales SOLO si cambiaron, o enviarlas en texto plano si quiere actualizarlas.
			// Si el frontend envía *** o un hash asumiendo que es "seguro", esto las re-encriptará.
			// Asumimos que la data que llega AQUÍ es raw y necesita encriptación.
			this.encryptEcommerceConfig(data);

			if (userId) {
				// @ts-ignore
				data.lastModifiedBy = userId;
			}

			// Actualizar
			const updatedConfig = await EcommerceConfig.findOneAndUpdate(
				{ key: 'global_config' },
				{ $set: data },
				{ new: true, runValidators: true, upsert: true }
			).lean();

			if (!updatedConfig) throw new AppError('Failed to update config', 'Error al actualizar configuración', 500);

			return this.decryptEcommerceConfig(updatedConfig as IEcommerceConfig);
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to update ecommerce config',
				'Error al actualizar la configuración de ecommerce',
				500
			);
		}
	};

	static deleteConfig = async (): Promise<void> => {
		try {
			await EcommerceConfig.findOneAndDelete({ key: 'global_config' });
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to delete ecommerce config',
				'Error al eliminar la configuración de ecommerce',
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

	private static encryptEcommerceConfig(data: IEcommerceConfig) {
		const configObj = data;
		if (configObj.paymentGateways) {
			if (configObj.paymentGateways.uala?.credentials) {
				const creds = configObj.paymentGateways.uala.credentials;
				if (creds.userName) creds.userName = JSON.stringify(encrypt(creds.userName));
				if (creds.clientId) creds.clientId = JSON.stringify(encrypt(creds.clientId));
				if (creds.clientSecret) creds.clientSecret = JSON.stringify(encrypt(creds.clientSecret));
			}
			if (configObj.paymentGateways.mercadopago) {
				const mp = configObj.paymentGateways.mercadopago;
				if (mp.accessToken) mp.accessToken = JSON.stringify(encrypt(mp.accessToken));
				if (mp.publicKey) mp.publicKey = JSON.stringify(encrypt(mp.publicKey));
			}
		}
	}

	private static decryptEcommerceConfig(config: IEcommerceConfig): IEcommerceConfig {
		const configObj = config;
		if (configObj.paymentGateways) {
			// Uala
			if (configObj.paymentGateways.uala?.credentials) {
				const creds = configObj.paymentGateways.uala.credentials;
				if (creds.userName) creds.userName = decrypt(JSON.parse(creds.userName));
				if (creds.clientId) creds.clientId = decrypt(JSON.parse(creds.clientId));
				if (creds.clientSecret) creds.clientSecret = decrypt(JSON.parse(creds.clientSecret));
			}
			// MercadoPago
			if (configObj.paymentGateways.mercadopago) {
				const mp = configObj.paymentGateways.mercadopago;
				if (mp.accessToken && mp.accessToken !== 'no asignado') {
					try {
						mp.accessToken = decrypt(JSON.parse(mp.accessToken));
					} catch (e) {
						// Si falla es porque tal vez no estaba encriptado (legacy o default)
						// Mantener el valor original o logear error
					}
				}
				if (mp.publicKey && mp.publicKey !== 'no asignado') {
					try {
						mp.publicKey = decrypt(JSON.parse(mp.publicKey));
					} catch (e) {
						console.error('Error al desencriptar publicKey de MercadoPago:', e);
					}
				}
			}
		}
		return configObj;

	}

}
