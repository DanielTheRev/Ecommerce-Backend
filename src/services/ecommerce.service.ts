import { AppError } from '@/errors/app.error';
import { EcommercePaymentProviders, IEcommerceConfig, IEcommerceConfigPublic } from '@/interfaces/ecommerce.interface';
import { TenantModels } from '@/config/modelRegistry';
import { decrypt, encrypt, safeDecryptString, safeEncryptString } from '@/utils/encryption';
import { flattenObject } from '@/utils/object.util';
import { MercadoPagoService } from './mercadopago.service';
import { ProductService } from './product.service';

export class EcommerceService {
	private static readonly SENSITIVE_FIELDS_SELECT = '+paymentGateways.uala.credentials.userName +paymentGateways.uala.credentials.clientId +paymentGateways.uala.credentials.clientSecret +paymentGateways.mercadopago.accessToken +paymentGateways.mercadopago.webhookSecret +integrations.metaPixel.accessToken +integrations.resend.apiKey +integrations.googleAuth.clientId';

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

	static getPublicConfig = async (models: TenantModels, tenantSlug?: string): Promise<Partial<IEcommerceConfigPublic>> => {
		try {
			const cacheKey = 'config:public';
			if (tenantSlug) {
				const { CacheService } = await import('./cache.service');
				const cached = CacheService.get<Partial<IEcommerceConfigPublic>>(tenantSlug, cacheKey);
				if (cached) return cached;
			}

			// Los campos sensibles tienen select: false en el esquema, por lo que findOne no los trae por defecto.
			const publicConfig = await models.EcommerceConfig.findOne({ key: 'global_config' })
				.select('+integrations.googleAuth.clientId')
				.lean() as unknown as IEcommerceConfig;

			if (!publicConfig)
				throw new AppError(
					'Ecommerce config not found',
					'Configuración de ecommerce no encontrada',
					404
				);

			// Desencriptar publicKey (ya que es guardada encriptada y sí es necesaria públicamente para inicializar MP)
			if (publicConfig.paymentGateways?.mercadopago?.publicKey && publicConfig.paymentGateways.mercadopago.publicKey !== 'no asignado') {
				publicConfig.paymentGateways.mercadopago.publicKey = safeDecryptString(publicConfig.paymentGateways.mercadopago.publicKey);
			}

			// Desencriptar googleAuth clientId si existe
			if (publicConfig.integrations?.googleAuth?.clientId) {
				publicConfig.integrations.googleAuth.clientId = safeDecryptString(publicConfig.integrations.googleAuth.clientId);
			}

			const data: IEcommerceConfigPublic = {
				name: publicConfig.name || 'Mi Tienda',
				logo: publicConfig.logo || '',
				contact: publicConfig.contact || { email: '', phone: '', address: '', whatsapp: '' },
				social: publicConfig.social || { instagram: '', facebook: '', twitter: '', tiktok: '' },
				brands: publicConfig.brands || [],
				categories: publicConfig.categories || [],
				clothingFits: publicConfig.clothingFits,
				shippingConfig: publicConfig.shippingConfig,
				workingHours: publicConfig.workingHours || {
					weekdayStart: '10:00',
					weekdayEnd: '20:00',
					sundayStart: '10:00',
					sundayEnd: '15:00',
					noticeText: 'Lun a Sáb 10-20h / Dom 10-15h'
				},
				absorbInstallments: publicConfig.pricingStrategy?.absorbInstallments ?? true,
				pricingStrategy: {
					absorbInstallments: publicConfig.pricingStrategy?.absorbInstallments ?? true,
					maxInstallmentsToAbsorb: publicConfig.pricingStrategy?.maxInstallmentsToAbsorb || 3,
					transferDiscountPercentage: publicConfig.pricingStrategy?.transferDiscountPercentage || 0,
					cashDiscountPercentage: publicConfig.pricingStrategy?.cashDiscountPercentage || 0
				},
				authConfig: {
					allowEmailPassword: publicConfig.authConfig?.allowEmailPassword ?? true,
					allowMagicCode: publicConfig.authConfig?.allowMagicCode ?? true,
					allowGoogle: publicConfig.authConfig?.allowGoogle ?? true,
					defaultMethod: publicConfig.authConfig?.defaultMethod || 'google'
				},
				integrations: {
					metaPixel: {
						active: publicConfig.integrations?.metaPixel?.active || false,
						pixelId: publicConfig.integrations?.metaPixel?.pixelId || ''
					},
					googleAnalytics: {
						active: publicConfig.integrations?.googleAnalytics?.active || false,
						measurementId: publicConfig.integrations?.googleAnalytics?.measurementId || ''
					},
					googleAuth: {
						active: publicConfig.integrations?.googleAuth?.active ?? true,
						clientId: publicConfig.integrations?.googleAuth?.clientId || ''
					},
					resend: {
						active: publicConfig.integrations?.resend?.active || false,
						fromEmail: publicConfig.integrations?.resend?.fromEmail || '',
						fromName: publicConfig.integrations?.resend?.fromName || ''
					}
				},
				paymentGateways: {
					mercadopago: {
						active: publicConfig.paymentGateways?.mercadopago?.active ?? false,
						publicKey: publicConfig.paymentGateways?.mercadopago?.publicKey || '',
						maxInstallments: publicConfig.paymentGateways?.mercadopago?.maxInstallments || 1,
						excludedPaymentMethods: publicConfig.paymentGateways?.mercadopago?.excludedPaymentMethods || [],
						excludedPaymentTypes: publicConfig.paymentGateways?.mercadopago?.excludedPaymentTypes || [],
					},
					transfer: {
						active: publicConfig.paymentGateways?.transfer?.active || false,
						alias: publicConfig.paymentGateways?.transfer?.alias || '',
						cbuCvu: publicConfig.paymentGateways?.transfer?.cbuCvu || '',
						bankName: publicConfig.paymentGateways?.transfer?.bankName || '',
						titular: publicConfig.paymentGateways?.transfer?.titular || ''
					}
				}
			};

			if (tenantSlug) {
				const { CacheService } = await import('./cache.service');
				CacheService.set(tenantSlug, cacheKey, data, 10 * 60 * 1000);
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

	static updateConfig = async (models: TenantModels, data: IEcommerceConfig, userId?: string, tenantSlug?: string): Promise<{ config: IEcommerceConfig; shouldRecalculate: boolean }> => {
		try {
			// 1. Obtenemos la configuración antigua antes de actualizar
			const oldConfig = await models.EcommerceConfig.findOne({ key: 'global_config' }).lean() as unknown as IEcommerceConfig;

			this.encryptEcommerceConfig(data);

			// Exclusividad de pasarela fintech (Solo 1 activa a la vez: Getnet vs Mercado Pago vs Ualá Bis)
			if (data.paymentGateways?.getnet?.active === true) {
				if (data.paymentGateways.mercadopago) data.paymentGateways.mercadopago.active = false;
				if (data.paymentGateways.uala) data.paymentGateways.uala.active = false;
			} else if (data.paymentGateways?.mercadopago?.active === true) {
				if (data.paymentGateways.getnet) data.paymentGateways.getnet.active = false;
				if (data.paymentGateways.uala) data.paymentGateways.uala.active = false;
			} else if (data.paymentGateways?.uala?.active === true) {
				if (data.paymentGateways.getnet) data.paymentGateways.getnet.active = false;
				if (data.paymentGateways.mercadopago) data.paymentGateways.mercadopago.active = false;
			}

			if (userId) {
				// @ts-ignore
				data.lastModifiedBy = userId;
			}

			// Aplanamos el objeto para permitir actualizaciones parciales en niveles profundos
			const flattenedData = flattenObject(data);

			const updatedConfig = await models.EcommerceConfig.findOneAndUpdate(
				{ key: 'global_config' },
				{ $set: flattenedData },
				{ new: true, runValidators: true, upsert: true }
			)
				.select(this.SENSITIVE_FIELDS_SELECT)
				.lean() as unknown as IEcommerceConfig;

			if (!updatedConfig) throw new AppError('Failed to update config', 'Error al actualizar configuración', 500);

			const finalConfig = this.decryptEcommerceConfig(updatedConfig);

			// Invalidar caché instantáneamente (Purge on Mutation)
			if (tenantSlug) {
				const { CacheService } = await import('./cache.service');
				CacheService.invalidatePrefix(tenantSlug, 'config');
				CacheService.invalidatePrefix(tenantSlug, 'home');
				CacheService.invalidatePrefix(tenantSlug, 'product');
			}

			// 2. Detectamos si algo que afecta precios cambió — devolvemos flag al frontend
			let shouldRecalculate = false;
			if (oldConfig) {
				const costCurrencyChanged = oldConfig.costCurrency !== finalConfig.costCurrency;
				const profitChanged = oldConfig.profit !== finalConfig.profit;
				const profit1PayChanged = oldConfig.profit1Pay !== finalConfig.profit1Pay;
				const profitInstallmentsChanged = oldConfig.profitInstallments !== finalConfig.profitInstallments;
				const ivaChanged = oldConfig.taxes?.iva !== finalConfig.taxes?.iva;
				const pricingMethodChanged = oldConfig.pricingStrategy?.method !== finalConfig.pricingStrategy?.method;
				const grossUpChanged = oldConfig.pricingStrategy?.transferGrossUp !== finalConfig.pricingStrategy?.transferGrossUp;
				const absorbChanged = oldConfig.pricingStrategy?.absorbInstallments !== finalConfig.pricingStrategy?.absorbInstallments;
				const card1PayDiscountChanged = oldConfig.pricingStrategy?.card1PayDiscount !== finalConfig.pricingStrategy?.card1PayDiscount;
				const gatewayChanged = oldConfig.paymentGateways?.getnet?.active !== finalConfig.paymentGateways?.getnet?.active
					|| oldConfig.paymentGateways?.mercadopago?.active !== finalConfig.paymentGateways?.mercadopago?.active;

				shouldRecalculate = costCurrencyChanged || profitChanged || profit1PayChanged
					|| profitInstallmentsChanged || ivaChanged || pricingMethodChanged
					|| grossUpChanged || absorbChanged || card1PayDiscountChanged || gatewayChanged;
			}

			return { config: finalConfig, shouldRecalculate };
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

	/**
	 * Simulación / Vista previa de recálculo masivo de precios sin impacto en base de datos.
	 */
	static previewPriceRecalculation = async (models: TenantModels, onlyActive: boolean = true) => {
		const config = await this.getConfig(models);
		return await ProductService.previewRecalculatePrices(models, config, onlyActive);
	};

	/**
	 * Recálculo masivo de precios — invocado MANUALMENTE por el vendedor tras confirmar en el modal.
	 */
	static triggerPriceRecalculation = async (models: TenantModels, onlyActive: boolean = true, tenantSlug?: string): Promise<{ updatedCount: number }> => {
		const config = await this.getConfig(models);
		const result = await ProductService.recalculateAllProductsPrices(models, config, onlyActive);
		if (tenantSlug) {
			const { CacheService } = await import('./cache.service');
			CacheService.invalidatePrefix(tenantSlug, 'product');
			CacheService.invalidatePrefix(tenantSlug, 'home');
		}
		return result;
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
				case EcommercePaymentProviders.GETNET:
					return config.paymentGateways?.getnet;
				case EcommercePaymentProviders.UALA:
					return config.paymentGateways?.uala?.credentials;
				case EcommercePaymentProviders.MERCADOPAGO:
					return config.paymentGateways?.mercadopago;
				case EcommercePaymentProviders.TRANSFER:
					return config.paymentGateways?.transfer;
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
			const paymentGateways: Record<EcommercePaymentProviders, any> = {
				[EcommercePaymentProviders.GETNET]: config.paymentGateways?.getnet,
				[EcommercePaymentProviders.UALA]: config.paymentGateways?.uala,
				[EcommercePaymentProviders.MERCADOPAGO]: config.paymentGateways?.mercadopago,
				[EcommercePaymentProviders.TRANSFER]: config.paymentGateways?.transfer
			};
			const selectedProvider = paymentGateways[provider];
			if (!selectedProvider)
				throw new AppError(
					`Provider ${provider} not found`,
					'No se encontró proveedor de pago',
					404
				);
			return selectedProvider;
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
				if (creds.userName) creds.userName = safeEncryptString(creds.userName);
				if (creds.clientId) creds.clientId = safeEncryptString(creds.clientId);
				if (creds.clientSecret) creds.clientSecret = safeEncryptString(creds.clientSecret);
			}
			if (configObj.paymentGateways.mercadopago) {
				const mp = configObj.paymentGateways.mercadopago;
				if (mp.accessToken) mp.accessToken = safeEncryptString(mp.accessToken);
				if (mp.publicKey) mp.publicKey = safeEncryptString(mp.publicKey);
				if (mp.webhookSecret) mp.webhookSecret = safeEncryptString(mp.webhookSecret);
			}
		}
		if (configObj.integrations?.metaPixel?.accessToken) {
			configObj.integrations.metaPixel.accessToken = safeEncryptString(configObj.integrations.metaPixel.accessToken);
		}
		if (configObj.integrations?.resend?.apiKey) {
			configObj.integrations.resend.apiKey = safeEncryptString(configObj.integrations.resend.apiKey);
		}
		if (configObj.integrations?.googleAuth?.clientId) {
			configObj.integrations.googleAuth.clientId = safeEncryptString(configObj.integrations.googleAuth.clientId);
		}
	}

	private static decryptEcommerceConfig(config: IEcommerceConfig): IEcommerceConfig {
		const configObj = config;
		if (configObj.paymentGateways) {
			// Uala
			if (configObj.paymentGateways.uala?.credentials) {
				const creds = configObj.paymentGateways.uala.credentials;
				if (creds.userName) creds.userName = safeDecryptString(creds.userName);
				if (creds.clientId) creds.clientId = safeDecryptString(creds.clientId);
				if (creds.clientSecret) creds.clientSecret = safeDecryptString(creds.clientSecret);
			}
			// MercadoPago
			if (configObj.paymentGateways.mercadopago) {
				const mp = configObj.paymentGateways.mercadopago;
				if (mp.accessToken && mp.accessToken !== 'no asignado') {
					mp.accessToken = safeDecryptString(mp.accessToken);
				}
				if (mp.publicKey && mp.publicKey !== 'no asignado') {
					mp.publicKey = safeDecryptString(mp.publicKey);
				}
				if (mp.webhookSecret && mp.webhookSecret !== 'no asignado') {
					mp.webhookSecret = safeDecryptString(mp.webhookSecret);
				}
			}
		}
		if (configObj.integrations?.metaPixel?.accessToken) {
			configObj.integrations.metaPixel.accessToken = safeDecryptString(configObj.integrations.metaPixel.accessToken);
		}
		if (configObj.integrations?.resend?.apiKey) {
			configObj.integrations.resend.apiKey = safeDecryptString(configObj.integrations.resend.apiKey);
		}
		if (configObj.integrations?.googleAuth?.clientId) {
			configObj.integrations.googleAuth.clientId = safeDecryptString(configObj.integrations.googleAuth.clientId);
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

	static getRecommendationsConfig = async (models: TenantModels) => {
		try {
			const config = await this.getConfig(models);
			const activeProductCategories = (await models.Product.distinct('category', { isActive: true })) as string[];
			const storeConfigCategories = config.categories || [];

			const availableCategories = Array.from(new Set([...storeConfigCategories, ...activeProductCategories]))
				.filter(c => c && typeof c === 'string' && c.trim() !== '');

			const savedRules = config.recommendationConfig?.rules || {};
			const resolvedRules: Record<string, string[]> = {};

			availableCategories.forEach((cat) => {
				if (savedRules[cat] && Array.isArray(savedRules[cat])) {
					resolvedRules[cat] = savedRules[cat].filter((t) => availableCategories.includes(t));
				} else {
					const norm = cat.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
					const def = DEFAULT_RECOMMENDATION_RULES[norm] || [];
					resolvedRules[cat] = def.filter((t) => availableCategories.includes(t));
				}
			});

			return {
				limit: config.recommendationConfig?.limit || 8,
				rules: resolvedRules,
				defaultRules: DEFAULT_RECOMMENDATION_RULES,
				availableCategories
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to fetch recommendations config',
				'Error al obtener la configuración de recomendaciones',
				500
			);
		}
	};

	static updateRecommendationsConfig = async (
		models: TenantModels,
		data: { limit?: number; rules?: Record<string, string[]> }
	) => {
		try {
			const updatePayload: any = {};
			if (data.limit !== undefined) {
				updatePayload['recommendationConfig.limit'] = Number(data.limit);
			}
			if (data.rules !== undefined) {
				updatePayload['recommendationConfig.rules'] = data.rules;
			}

			const updatedConfig = await models.EcommerceConfig.findOneAndUpdate(
				{ key: 'global_config' },
				{ $set: updatePayload },
				{ new: true, upsert: true }
			).lean() as unknown as IEcommerceConfig;

			return {
				limit: updatedConfig.recommendationConfig?.limit || 8,
				rules: updatedConfig.recommendationConfig?.rules || {}
			};
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to update recommendations config',
				'Error al actualizar la configuración de recomendaciones',
				500
			);
		}
	};

}

export const DEFAULT_RECOMMENDATION_RULES: Record<string, string[]> = {
	// Indumentaria (Clothing)
	buzos: ['Remeras', 'Pantalones', 'Sacos', 'Camperas'],
	buzo: ['Remeras', 'Pantalones', 'Sacos', 'Camperas'],
	remeras: ['Pantalones', 'Sacos', 'Buzos', 'Camperas', 'Shorts'],
	remera: ['Pantalones', 'Sacos', 'Buzos', 'Camperas', 'Shorts'],
	tops: ['Pantalones', 'Sacos', 'Buzos', 'Shorts', 'Remeras'],
	top: ['Pantalones', 'Sacos', 'Buzos', 'Shorts', 'Remeras'],
	pantalones: ['Remeras', 'Sacos', 'Buzos', 'Camperas', 'Tops'],
	pantalon: ['Remeras', 'Sacos', 'Buzos', 'Camperas', 'Tops'],
	sacos: ['Remeras', 'Pantalones', 'Tops', 'Buzos'],
	saco: ['Remeras', 'Pantalones', 'Tops', 'Buzos'],
	camperas: ['Remeras', 'Pantalones', 'Buzos', 'Sacos'],
	campera: ['Remeras', 'Pantalones', 'Buzos', 'Sacos'],
	shorts: ['Remeras', 'Tops', 'Zapatillas', 'Shorts'],
	short: ['Remeras', 'Tops', 'Zapatillas', 'Shorts'],
	polleras: ['Remeras', 'Tops', 'Sacos', 'Camperas'],
	pollera: ['Remeras', 'Tops', 'Sacos', 'Camperas'],
	vestidos: ['Sacos', 'Camperas', 'Zapatillas', 'Accesorios'],
	vestido: ['Sacos', 'Camperas', 'Zapatillas', 'Accesorios'],
	zapatillas: ['Pantalones', 'Remeras', 'Shorts', 'Zapatillas'],
	zapatilla: ['Pantalones', 'Remeras', 'Shorts', 'Zapatillas'],
	accesorios: ['Remeras', 'Pantalones', 'Buzos', 'Vestidos'],
	accesorio: ['Remeras', 'Pantalones', 'Buzos', 'Vestidos'],

	// Tecnología (Tech)
	smartphones: ['Fundas / Cases', 'Vidrios Templados', 'Auriculares', 'Cargadores', 'Smartphones'],
	smartphone: ['Fundas / Cases', 'Vidrios Templados', 'Auriculares', 'Cargadores', 'Smartphones'],
	celulares: ['Fundas / Cases', 'Vidrios Templados', 'Auriculares', 'Cargadores', 'Smartphones'],
	celular: ['Fundas / Cases', 'Vidrios Templados', 'Auriculares', 'Cargadores', 'Smartphones'],
	pantallas: ['Soportes', 'Cables / Adaptadores', 'Barras de Sonido', 'TV / Monitores'],
	monitores: ['Soportes', 'Cables / Adaptadores', 'Teclados / Mouse', 'PC'],
	tv: ['Soportes', 'Cables / Adaptadores', 'Barras de Sonido', 'TV / Monitores'],
	pc: ['Monitores', 'Teclados / Mouse', 'Auriculares', 'PC'],
	consolas: ['Joysticks / Controles', 'Juegos', 'Auriculares', 'Consolas'],
	consola: ['Joysticks / Controles', 'Juegos', 'Auriculares', 'Consolas'],
	electrodomesticos: ['Accesorios', 'Electrodomésticos'],
	electrodomestico: ['Accesorios', 'Electrodomésticos']
};
