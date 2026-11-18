import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { EcommerceService } from '@/services/ecommerce.service';
import {
	MP_DEFAULT_CFT,
	MP_POS_POINT_RATES,
	MP_QR_RATES,
	MP_WEB_CHECKOUT_RATES
} from './mpRates.catalog';
import { PriceBuilderEngine, buildPresetChannelPricing } from './priceBuilder.engine';
import { IPriceBuilderCalculateInput, IPriceBuilderCalculateResult } from './priceBuilder.types';

export class PriceBuilderService {
	private constructor() {}

	static getPresetsAndRates() {
		return {
			presets: {
				'2_prices': {
					label: '2 Precios (Contado protegido + Lista)',
					channelPricing: buildPresetChannelPricing('2_prices')
				},
				'3_prices': {
					label: '3 Precios (Contado + 1 Pago + Lista)',
					channelPricing: buildPresetChannelPricing('3_prices')
				},
				'6_channels': {
					label: '6 Canales (Independientes)',
					channelPricing: buildPresetChannelPricing('6_channels')
				}
			},
			mercadoPagoRates: {
				note: 'Tasas netas sin IVA. Vexx suma el IVA configurado automáticamente.',
				webCheckout: MP_WEB_CHECKOUT_RATES,
				defaultCft: MP_DEFAULT_CFT,
				qr: MP_QR_RATES,
				posPoint: MP_POS_POINT_RATES
			}
		};
	}

	static async calculatePreview(
		models: TenantModels,
		payload: Omit<IPriceBuilderCalculateInput, 'config' | 'dolar'> & { costPrice?: number; dolar?: number }
	): Promise<IPriceBuilderCalculateResult> {
		const config = await EcommerceService.getConfig(models);
		const providerCost = payload.providerCost ?? payload.costPrice;
		if (providerCost === undefined || providerCost === null || Number.isNaN(Number(providerCost))) {
			throw new AppError('Validation Error', 'El campo providerCost (o costPrice) es obligatorio.', 400);
		}

		let dolar = Number(payload.dolar || 0);
		if (dolar <= 0) {
			if (config.costCurrency === 'USD') {
				dolar = Number(config.customDollarRate || 0);
				if (dolar <= 0) {
					throw new AppError(
						'Dollar rate missing',
						'El comercio opera en USD pero no tiene configurada una cotización válida.',
						400
					);
				}
			} else {
				dolar = 1;
			}
		}

		return PriceBuilderEngine.calculate({
			...payload,
			providerCost: Number(providerCost),
			useCustomProfit: payload.useCustomProfit ?? payload.customProfitMargin !== undefined,
			dolar,
			config
		});
	}
}
