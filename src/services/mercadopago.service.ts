import { MercadoPagoConfig, Preference, Payment, PaymentMethod, OAuth } from 'mercadopago';
import { AppError } from '@/errors/app.error';

export interface IMPItem {
	id: string;
	title: string;
	quantity: number;
	unit_price: number;
	currency_id: string;
}

export class MercadoPagoService {



	/**
		 * Intercambia el código de autorización por los tokens del vendedor (Access Token y Public Key).
		 * Utiliza las credenciales maestras de NexoCommerce.
		 */
	static async exchangeAuthorizationCode(code: string, redirectUri: string) {
		try {
			// 1. Validamos que tengamos las credenciales maestras en el .env
			const masterClientId = process.env.MP_MASTER_CLIENT_ID;
			const masterClientSecret = process.env.MP_MASTER_CLIENT_SECRET;

			if (!masterClientId || !masterClientSecret) {
				throw new AppError(
					'Missing MP Master Credentials',
					'Error interno de configuración de la plataforma.',
					500
				);
			}

			// 2. Inicializamos el cliente con un token dummy (el SDK lo requiere, pero para OAuth no se usa)
			const client = new MercadoPagoConfig({
				accessToken: 'dummy-token-for-oauth',
				options: { timeout: 10000 } // Le damos 10s por las dudas
			});

			const oauth = new OAuth(client);

			// 3. Ejecutamos el canje contra la API de Mercado Pago
			const result = await oauth.create({
				body: {
					client_id: masterClientId,
					client_secret: masterClientSecret,
					code: code,
					redirect_uri: redirectUri,
					// grant_type: 'authorization_code' // Opcional, el SDK suele inferirlo
				}
			});

			// 4. Retornamos los tokens para que el Controller los guarde en la BD
			return {
				accessToken: result.access_token,
				publicKey: result.public_key,
				refreshToken: result.refresh_token,
				userId: result.user_id,
				expiresIn: result.expires_in
			};

		} catch (error: any) {
			console.error('Error exchanging MP Authorization Code:', error);

			// Si el error viene de MP, armamos un AppError más amigable
			if (error.cause && error.cause.length > 0) {
				const mpError = error.cause[0];
				throw new AppError(
					'MercadoPago OAuth Error',
					`Error de vinculación: ${mpError.description || mpError.message}`,
					400
				);
			}

			throw new AppError('MercadoPago OAuth Error', 'No se pudo vincular la cuenta de Mercado Pago.', 500);
		}
	}

	/**
	 * Crea un pago en MercadoPago usando el SDK oficial (v1/payments)
	 */
	static async createPayment(accessToken: string, paymentBody: any) {
		try {
			const client = new MercadoPagoConfig({ accessToken });
			const payment = new Payment(client);

			const result = await payment.create({
				body: paymentBody,
				requestOptions: {
					idempotencyKey: crypto.randomUUID()
				}
			});

			return result;
		} catch (error: any) {
			console.error('Error in createPayment (SDK):', error);
			if (error.message || error.errors) {
				throw new AppError('MercadoPago API Error', error.message || 'Error al procesar el pago', 400);
			}
			throw error;
		}
	}

	/**
	 * Crea una "Order" en MercadoPago (Checkout API vía Orders)
	 * @deprecated Usar createPayment para soporte de notification_url dinámico
	 */
	static async createOrder(accessToken: string, mpOrderData: any) {
		try {
			const response = await fetch('https://api.mercadopago.com/v1/orders', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${accessToken}`,
					'X-Idempotency-Key': crypto.randomUUID()
				},
				body: JSON.stringify(mpOrderData)
			});

			const result = await response.json();

			if (!response.ok && result.errors !== null) {
				console.error('MP Orders API Error:', JSON.stringify(result));
				throw new AppError('MercadoPago API Error', result.message || 'Error al procesar el pago', response.status);
			}

			return result;
		} catch (error: any) {
			console.error('Error in createOrder (Checkout API):', error);
			throw error;
		}
	}

	/**
	 * Obtiene el estado de un pago mediante su ID
	 */
	static async getPaymentStatus(accessToken: string, paymentId: string) {
		try {
			const client = new MercadoPagoConfig({ accessToken });
			const payment = new Payment(client);

			const result = await payment.get({ id: paymentId });
			return result;
		} catch (error: any) {
			console.error('Error fetching MercadoPago payment:', error);
			throw new AppError(
				'Failed to fetch MercadoPago payment details',
				'Error al recuperar detalles del pago de MercadoPago',
				500
			);
		}
	}

	/**
	 * Obtiene los métodos de pago disponibles (para el Panel de Control)
	 */
	static async getAvailableMethods(accessToken: string) {
		try {
			const client = new MercadoPagoConfig({ accessToken });
			const paymentMethods = new PaymentMethod(client);

			const result = await paymentMethods.get();
			return result.map(m => ({
				id: m.id,
				name: m.name,
				payment_type_id: m.payment_type_id,
				thumbnail: m.thumbnail,
				status: m.status
			}));
		} catch (error: any) {
			console.error('Error fetching MP methods:', error);
			throw new AppError('Failed to fetch MP methods', 'Error al obtener medios de pago', 500);
		}
	}

	/**
	 * Valida la firma de un webhook de Mercado Pago
	 */
	static validateSignature(secretKey: string, xSignature: string, xRequestId: string, dataId: string): boolean {
		try {
			if (!xSignature || !secretKey) return false;

			const parts = xSignature.split(',');
			let ts: string | undefined;
			let hash: string | undefined;

			parts.forEach(part => {
				const [key, value] = part.split('=');
				if (key && value) {
					const trimmedKey = key.trim();
					const trimmedValue = value.trim();
					if (trimmedKey === 'ts') ts = trimmedValue;
					else if (trimmedKey === 'v1') hash = trimmedValue;
				}
			});

			if (!ts || !hash) return false;

			// EL ID DEBE ESTAR EN MINUSCULAS PARA VALIDAR LA FIRMA
			const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;

			const crypto = require('crypto');
			const hmac = crypto.createHmac('sha256', secretKey);
			hmac.update(manifest);
			const expectedHash = hmac.digest('hex');

			return expectedHash === hash;
		} catch (error) {
			console.error('Error validating Mercado Pago signature:', error);
			return false;
		}
	}

	/**
	 * Obtiene los detalles de una orden mediante su ID
	 */
	static async getOrder(accessToken: string, orderId: string) {
		try {
			const response = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${accessToken}`
				}
			});

			const result = await response.json();

			if (!response.ok) {
				console.error('MP Get Order API Error:', result);
				throw new AppError('MercadoPago API Error', result.message || 'Error al obtener la orden', response.status);
			}

			return result;
		} catch (error: any) {
			console.error('Error in getOrder (Checkout API):', error);
			throw error;
		}
	}
}
