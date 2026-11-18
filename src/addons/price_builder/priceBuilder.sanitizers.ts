import { GatewayEnvironment, ISanitizedPublicStoreConfig } from './priceBuilder.types';

function maskSecret(val?: string): string {
	if (!val || val === 'no asignado') return '';
	if (val.length <= 6) return '••••••';
	return `••••${val.slice(-4)}`;
}

/**
 * Escenario 2: Proyección para Devs del Panel de Control (Web & Android).
 * Enmascara tokens/secrets y agrega flags booleanos + URLs de Sandbox Preview.
 */
export function toAdminConfigView(rawConfig: any, storeBaseUrl?: string): any {
	if (!rawConfig) return rawConfig;
	const plain = typeof rawConfig.toObject === 'function' ? rawConfig.toObject() : { ...rawConfig };
	const mp = plain?.paymentGateways?.mercadopago;
	if (!mp) return plain;

	const prodCreds = mp.credentials?.production || {};
	const sbxCreds = mp.credentials?.sandbox || {};
	const prodAccess = prodCreds.accessToken || mp.accessToken;
	const prodWebhook = prodCreds.webhookSecret || mp.webhookSecret;
	const prodPk = prodCreds.publicKey || (mp.publicKey !== 'no asignado' ? mp.publicKey : '');

	const sbxAccess = sbxCreds.accessToken;
	const sbxWebhook = sbxCreds.webhookSecret;
	const sbxPk = sbxCreds.publicKey || '';

	const baseUrl = storeBaseUrl || plain.domain || 'https://tienda.vexx.ar';
	const minToken = mp.storefrontChannels?.minimalCatalog?.sandboxToken || '';
	const webToken = mp.storefrontChannels?.webTemplate?.sandboxToken || '';

	mp.oauth = {
		connected: Boolean(mp.oauth?.connected || mp.oauth?.mpUserId),
		mpUserId: mp.oauth?.mpUserId || null,
		tokenExpiresAt: mp.oauth?.tokenExpiresAt || null,
		hasRefreshToken: Boolean(mp.oauth?.refreshToken)
	};

	mp.credentials = {
		production: {
			credentialSource: prodCreds.credentialSource || (mp.oauth.connected ? 'oauth' : 'manual'),
			publicKey: prodPk,
			accessTokenMasked: maskSecret(prodAccess),
			hasAccessToken: Boolean(prodAccess && prodAccess !== 'no asignado'),
			webhookSecretMasked: maskSecret(prodWebhook),
			hasWebhookSecret: Boolean(prodWebhook && prodWebhook !== 'no asignado')
		},
		sandbox: {
			publicKey: sbxPk,
			accessTokenMasked: maskSecret(sbxAccess),
			hasAccessToken: Boolean(sbxAccess),
			webhookSecretMasked: maskSecret(sbxWebhook),
			hasWebhookSecret: Boolean(sbxWebhook)
		}
	};

	if (mp.storefrontChannels) {
		if (mp.storefrontChannels.minimalCatalog) {
			mp.storefrontChannels.minimalCatalog.sandboxPreviewUrl = minToken ? `${baseUrl}/?vexx_sandbox=${minToken}` : '';
		}
		if (mp.storefrontChannels.webTemplate) {
			mp.storefrontChannels.webTemplate.sandboxPreviewUrl = webToken ? `${baseUrl}/?vexx_sandbox=${webToken}` : '';
		}
	}

	delete mp.accessToken;
	delete mp.webhookSecret;

	return plain;
}

/**
 * Escenario 3A: Proyección pública para Plantillas / Storefront / Web Custom.
 * CERO secretos, CERO costos, CERO márgenes privados.
 */
export function toPublicStoreConfigView(
	rawConfig: any,
	resolvedEnvironment?: GatewayEnvironment
): ISanitizedPublicStoreConfig {
	const gateways = rawConfig?.paymentGateways || {};
	const gwKey = gateways.defaultWebGateway || gateways.defaultGateway || 'mercadopago';
	const mp = gateways.mercadopago || {};
	const env: GatewayEnvironment = resolvedEnvironment || mp.environment || 'production';

	const publicKey = env === 'sandbox'
		? (mp.credentials?.sandbox?.publicKey || '')
		: (mp.credentials?.production?.publicKey || (mp.publicKey && mp.publicKey !== 'no asignado' ? mp.publicKey : ''));

	return {
		gateway: gwKey,
		environment: env,
		isTestMode: env === 'sandbox',
		publicKey,
		checkoutMode: mp.checkoutMode || 'pro',
		maxInstallments: Number(mp.maxInstallments || rawConfig?.pricingStrategy?.maxInstallmentsToAbsorb || 1),
		absorbInstallments: Boolean(rawConfig?.pricingStrategy?.absorbInstallments),
		excludedPaymentMethods: Array.isArray(mp.excludedPaymentMethods) ? mp.excludedPaymentMethods : [],
		excludedPaymentTypes: Array.isArray(mp.excludedPaymentTypes) ? mp.excludedPaymentTypes : []
	};
}

/**
 * Escenario 3B: Proyección pública de un producto (elimina finanzas y netProfit).
 */
export function toPublicProductPriceView(product: any): any {
	if (!product) return product;
	const plain = typeof product.toObject === 'function' ? product.toObject() : { ...product };
	delete plain.finance;
	delete plain.channelPricing;

	if (plain.price?.channels) {
		const sanitizedChannels: Record<string, { enabled: boolean; price: number; surface: string }> = {};
		for (const [k, v] of Object.entries<any>(plain.price.channels)) {
			if (v && v.enabled !== false) {
				sanitizedChannels[k] = {
					enabled: true,
					price: Number(v.price) || 0,
					surface: v.surface || 'all'
				};
			}
		}
		plain.price = {
			...plain.price,
			channels: sanitizedChannels
		};
	}

	return plain;
}
