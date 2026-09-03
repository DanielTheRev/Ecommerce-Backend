import { AppError } from '@/errors/app.error';

export interface IGetnetItem {
	name: string;
	quantity: number;
	unit_price: number;
	currency?: string;
}

export interface IGetnetCustomer {
	first_name: string;
	last_name: string;
	email: string;
	phone_number?: string;
	document_type?: string;
	document_number?: string;
}

export interface IGetnetCreateSessionOptions {
	orderId: string;
	amount: number;
	currency?: string;
	description?: string;
	customer: IGetnetCustomer;
	items: IGetnetItem[];
	maxInstallments?: number;
	returnUrls: {
		success: string;
		failure: string;
		pending?: string;
	};
	notificationUrl: string;
	credentials: {
		clientId: string;
		clientSecret: string;
	};
	environment?: 'sandbox' | 'production';
}

interface ITokenCache {
	token: string;
	expiresAt: number;
}

export class GetnetService {
	private static tokenCache: Map<string, ITokenCache> = new Map();

	private static getBaseUrl(environment: 'sandbox' | 'production' = 'sandbox'): string {
		return environment === 'production'
			? 'https://api.globalgetnet.com'
			: 'https://api.sandbox.globalgetnet.com';
	}

	private static getCheckoutUrl(environment: 'sandbox' | 'production' = 'sandbox'): string {
		return environment === 'production'
			? 'https://checkout.globalgetnet.com'
			: 'https://checkout.sandbox.globalgetnet.com';
	}

	/**
	 * Obtiene o reutiliza un Bearer Token OAuth 2.0 (Client Credentials Flow)
	 */
	static async getOAuthToken(clientId: string, clientSecret: string, environment: 'sandbox' | 'production' = 'sandbox'): Promise<string> {
		if (!clientId || !clientSecret) {
			throw new AppError('Getnet Missing Credentials', 'Credenciales de Getnet (Client ID / Secret) no configuradas', 400);
		}

		const cacheKey = `${environment}:${clientId}`;
		const cached = this.tokenCache.get(cacheKey);

		// Si el token aún es válido por al menos 2 minutos más, reutilizarlo
		if (cached && cached.expiresAt > Date.now() + 120 * 1000) {
			return cached.token;
		}

		const baseUrl = this.getBaseUrl(environment);
		const tokenEndpoint = `${baseUrl}/v1/tokens/bearer`;

		try {
			const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

			const response = await fetch(tokenEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Authorization': `Basic ${authHeader}`
				},
				body: new URLSearchParams({
					grant_type: 'client_credentials',
					scope: 'oob'
				}).toString()
			});

			if (!response.ok) {
				const errorBody = await response.text();
				console.error('Error fetching Getnet OAuth Token:', response.status, errorBody);
				throw new AppError(
					'Getnet Auth Error',
					`Error al autenticar con Getnet: ${response.statusText}`,
					response.status
				);
			}

			const data = await response.json() as { access_token: string; expires_in?: number; token_type?: string };
			const expiresIn = data.expires_in || 3600; // Por defecto 1 hora

			this.tokenCache.set(cacheKey, {
				token: data.access_token,
				expiresAt: Date.now() + expiresIn * 1000
			});

			return data.access_token;
		} catch (error: any) {
			if (error instanceof AppError) throw error;
			console.error('Getnet Authentication Exception:', error);
			throw new AppError('Getnet Authentication Failed', 'No se pudo conectar con los servidores de Getnet', 500);
		}
	}

	/**
	 * Crea una sesión de Web Checkout (Redirect o Modal)
	 */
	static async createWebCheckoutSession(options: IGetnetCreateSessionOptions): Promise<{
		checkoutId: string;
		initPointUrl: string;
		rawResponse: any;
	}> {
		const env = options.environment || 'sandbox';
		const token = await this.getOAuthToken(
			options.credentials.clientId,
			options.credentials.clientSecret,
			env
		);

		const baseUrl = this.getBaseUrl(env);
		const checkoutEndpoint = `${baseUrl}/v1/checkouts`;

		const payload = {
			order_id: options.orderId,
			amount: options.amount,
			currency: options.currency || 'ARS',
			description: options.description || `Orden #${options.orderId}`,
			customer: {
				first_name: options.customer.first_name || 'Cliente',
				last_name: options.customer.last_name || 'Ecommerce',
				email: options.customer.email,
				phone_number: options.customer.phone_number || ''
			},
			items: options.items.map(item => ({
				name: item.name,
				quantity: item.quantity,
				unit_price: item.unit_price,
				currency: item.currency || 'ARS'
			})),
			payment_method: {
				max_installments: options.maxInstallments || 6
			},
			return_urls: {
				success: options.returnUrls.success,
				failure: options.returnUrls.failure,
				pending: options.returnUrls.pending || options.returnUrls.success
			},
			notification_url: options.notificationUrl
		};

		try {
			const response = await fetch(checkoutEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`,
					'X-Idempotency-Key': crypto.randomUUID()
				},
				body: JSON.stringify(payload)
			});

			const responseData = await response.json() as any;

			if (!response.ok) {
				console.error('Error creating Getnet Web Checkout session:', response.status, responseData);
				throw new AppError(
					'Getnet Checkout Error',
					responseData.message || responseData.error || 'Error al iniciar el checkout con Getnet',
					response.status
				);
			}

			// URL de inicialización del Web Checkout
			const checkoutId = responseData.checkout_id || responseData.id || responseData.session_id;
			const checkoutBaseUrl = this.getCheckoutUrl(env);
			const initPointUrl = responseData.redirect_url || responseData.init_point || `${checkoutBaseUrl}/checkout/${checkoutId}`;

			return {
				checkoutId,
				initPointUrl,
				rawResponse: responseData
			};
		} catch (error: any) {
			if (error instanceof AppError) throw error;
			console.error('Getnet Web Checkout Exception:', error);
			throw new AppError('Getnet Checkout Failed', 'Error al procesar la sesión de pago con Getnet', 500);
		}
	}

	/**
	 * Consulta el estado de un pago o checkout en Getnet
	 */
	static async getPaymentStatus(
		paymentId: string,
		credentials: { clientId: string; clientSecret: string },
		environment: 'sandbox' | 'production' = 'sandbox'
	) {
		const token = await this.getOAuthToken(credentials.clientId, credentials.clientSecret, environment);
		const baseUrl = this.getBaseUrl(environment);

		try {
			const response = await fetch(`${baseUrl}/v1/payments/${paymentId}`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errorBody = await response.text();
				console.error('Getnet Payment Status Error:', response.status, errorBody);
				throw new AppError('Getnet Status Error', 'No se pudo consultar el estado del pago en Getnet', response.status);
			}

			return await response.json();
		} catch (error: any) {
			if (error instanceof AppError) throw error;
			console.error('Getnet getPaymentStatus Exception:', error);
			throw new AppError('Getnet Status Failed', 'Error al consultar estado en Getnet', 500);
		}
	}

	/**
	 * Verifica la firma de un Webhook de Getnet
	 */
	static verifyWebhookSignature(headers: Record<string, any>, body: any, webhookSecret?: string): boolean {
		if (!webhookSecret) return true; // Si no está configurado secret, permitir
		const signature = headers['x-getnet-signature'] || headers['x-signature'];
		if (!signature) return false;
		try {
			const crypto = require('crypto');
			const expectedSignature = crypto
				.createHmac('sha256', webhookSecret)
				.update(typeof body === 'string' ? body : JSON.stringify(body))
				.digest('hex');
			return signature === expectedSignature;
		} catch {
			return false;
		}
	}
}