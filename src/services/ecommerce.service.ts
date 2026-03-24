import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders, IEcommerceConfig, IEcommerceConfigPublic } from '@/interfaces/ecommerce.interface';
import { TenantModels } from '@/config/modelRegistry';
import { decrypt, encrypt } from '@/utils/encryption';
import { flattenObject } from '@/utils/object.util';
import { MercadoPagoService } from './mercadopago.service';

export class EcommerceService {
	private static readonly SENSITIVE_FIELDS_SELECT = '+paymentGateways.uala.credentials.userName +paymentGateways.uala.credentials.clientId +paymentGateways.uala.credentials.clientSecret +paymentGateways.mercadopago.accessToken +paymentGateways.mercadopago.webhookSecret';

	private constructor() { }

	static seedDefaultConfig = async (models: TenantModels) => {
		try {
			const configExists = await models.EcommerceConfig.findOne({ key: 'global_config' });

			if (!configExists) {
				console.log('🌱 Creando configuración inicial del Ecommerce...');
				await models.EcommerceConfig.create({ key: 'global_config' });
				console.log('✅ Configuración inicial creada con éxito.');
			}
		} catch (error) {
			throw new Error('❌ Error al inicializar la configuración:');
		}
	};

	static getConfig = async (models: TenantModels): Promise<IEcommerceConfig> => {
		try {
			const config = await models.EcommerceConfig.findOne({ key: 'global_config' })
				.select(this.SENSITIVE_FIELDS_SELECT)
				.lean() as unknown as IEcommerceConfig;

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
			console.log(error);
			throw new AppError(
				'Failed to fetch ecommerce config',
				'Error al obtener la configuración de ecommerce',
				500
			);
		}
	};

	static getPublicConfig = async (models: TenantModels): Promise<Partial<IEcommerceConfigPublic>> => {
		try {
			// Los campos sensibles tienen select: false en el esquema, por lo que findOne no los trae por defecto.
			const publicConfig = await models.EcommerceConfig.findOne({ key: 'global_config' }).lean() as unknown as IEcommerceConfig;
			
			if (!publicConfig)
				throw new AppError(
					'Ecommerce config not found',
					'Configuración de ecommerce no encontrada',
					404
				);

			// Desencriptar publicKey (ya que es guardada encriptada y sí es necesaria públicamente para inicializar MP)
			if (publicConfig.paymentGateways?.mercadopago?.publicKey && publicConfig.paymentGateways.mercadopago.publicKey !== 'no asignado') {
				try {
					publicConfig.paymentGateways.mercadopago.publicKey = decrypt(JSON.parse(publicConfig.paymentGateways.mercadopago.publicKey));
				} catch (e) {
					console.error('Error al desencriptar publicKey de MercadoPago en configuración pública:', e);
				}
			}

			const data: IEcommerceConfigPublic = {
				contact: publicConfig.contact!,
				social: publicConfig.social!,
				paymentGateways: {
					mercadopago: {
						publicKey: publicConfig.paymentGateways?.mercadopago?.publicKey || '',
						maxInstallments: publicConfig.paymentGateways?.mercadopago?.maxInstallments || 1,
						excludedPaymentMethods: publicConfig.paymentGateways?.mercadopago?.excludedPaymentMethods || [],
						excludedPaymentTypes: publicConfig.paymentGateways?.mercadopago?.excludedPaymentTypes || [],
					}
				}
			}

			return data;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to fetch public ecommerce config',
				'Error al obtener la configuración pública de ecommerce',
				500
			);
		}
	};

	static createConfig = async (models: TenantModels, data: IEcommerceConfig, userId?: string): Promise<IEcommerceConfig> => {
		try {
			const existingConfig = await models.EcommerceConfig.findOne({ key: 'global_config' });
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

			const newConfig = await models.EcommerceConfig.create(data);

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

	static updateConfig = async (models: TenantModels, data: IEcommerceConfig, userId?: string): Promise<IEcommerceConfig> => {
		try {
			this.encryptEcommerceConfig(data);

			if (userId) {
				// @ts-ignore
				data.lastModifiedBy = userId;
			}

			// Aplanamos el objeto para permitir actualizaciones parciales en niveles profundos
			// evitando que se borren campos hermanos (como uala al actualizar mercadopago)
			const flattenedData = flattenObject(data);

			const updatedConfig = await models.EcommerceConfig.findOneAndUpdate(
				{ key: 'global_config' },
				{ $set: flattenedData },
				{ new: true, runValidators: true, upsert: true }
			)
				.select(this.SENSITIVE_FIELDS_SELECT)
				.lean();

			if (!updatedConfig) throw new AppError('Failed to update config', 'Error al actualizar configuración', 500);

			return this.decryptEcommerceConfig(updatedConfig as unknown as IEcommerceConfig);
		} catch (error) {
			console.log(error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to update ecommerce config',
				'Error al actualizar la configuración de ecommerce',
				500
			);
		}
	};

	static deleteConfig = async (models: TenantModels): Promise<void> => {
		try {
			await models.EcommerceConfig.findOneAndDelete({ key: 'global_config' });
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to delete ecommerce config',
				'Error al eliminar la configuración de ecommerce',
				500
			);
		}
	};

	static getCredentials = async (models: TenantModels, provider: EcommercePaymentProviders) => {
		try {
			const config = await this.getConfig(models);
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

	static async getPaymentGateway(models: TenantModels, provider: EcommercePaymentProviders) {
		try {
			const config = await this.getConfig(models);
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
				if (mp.webhookSecret) mp.webhookSecret = JSON.stringify(encrypt(mp.webhookSecret));
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
					}
				}
				if (mp.publicKey && mp.publicKey !== 'no asignado') {
					try {
						mp.publicKey = decrypt(JSON.parse(mp.publicKey));
					} catch (e) {
						console.error('Error al desencriptar publicKey de MercadoPago:', e);
					}
				}
				if (mp.webhookSecret && mp.webhookSecret !== 'no asignado') {
					try {
						mp.webhookSecret = decrypt(JSON.parse(mp.webhookSecret));
					} catch (e) {
						console.error('Error al desencriptar webhookSecret de MercadoPago:', e);
					}
				}
			}
		}
		return configObj;

	}

	static handleMercadoPagoOAuth = async (models: TenantModels, code: string): Promise<void> => {
		try {
			const redirectUri = process.env.MP_REDIRECT_URI;

			if (!redirectUri) {
				throw new AppError('Configuración incompleta', 'Falta la variable MP_REDIRECT_URI', 500);
			}

			// 1. Delegamos el trabajo sucio al servicio de Mercado Pago (SDK)
			// Él se encarga de hablar con la API y nos devuelve los tokens limpios
			const mpTokens = await MercadoPagoService.exchangeAuthorizationCode(code, redirectUri);

			// 2. Armamos el objeto para actualizar la configuración
			const configToUpdate = {
				paymentGateways: {
					mercadopago: {
						active: true,
						accessToken: mpTokens.accessToken,
						publicKey: mpTokens.publicKey,
						refreshToken: mpTokens.refreshToken
					}
				}
			} as unknown as IEcommerceConfig;

			// 3. Guardamos usando tu método existente (encriptación y base de datos)
			await this.updateConfig(models, configToUpdate);

		} catch (error: any) {
			console.error('Error en el flujo OAuth:', error);

			if (error instanceof AppError) throw error;

			throw new AppError(
				'Failed to authenticate with Mercado Pago',
				'Error al vincular la cuenta con Mercado Pago',
				500
			);
		}
	};

}
