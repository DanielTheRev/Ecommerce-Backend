import { MercadoPagoConfig, Preference, Payment, PaymentMethod } from 'mercadopago';
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
	 * Crea una "Order" en MercadoPago (Checkout API vía Orders)
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
