import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { ICreatePointOrderDTO, IPointDevice, IPointOrderResponse } from '@/interfaces/point.interface';
import { EcommerceService } from './ecommerce.service';
import crypto from 'crypto';

export class MercadoPagoPointService {
	/**
	 * Obtiene el access token de Mercado Pago configurado y desencriptado para el tenant.
	 */
	private static async getAccessToken(models: TenantModels): Promise<string> {
		const config = await EcommerceService.getConfig(models);
		const mp = config?.paymentGateways?.mercadopago;

		if (!mp || !mp.active) {
			throw new AppError(
				'Mercado Pago no configurado',
				'Debés activar y vincular tu cuenta de Mercado Pago desde Configuración antes de operar con terminales Point.',
				400
			);
		}

		if (!mp.accessToken || mp.accessToken === 'no asignado' || mp.accessToken.trim() === '') {
			throw new AppError(
				'Mercado Pago desconectado',
				'No se encontró un token de acceso válido de Mercado Pago. Por favor volvé a vincular tu cuenta.',
				401
			);
		}

		return mp.accessToken.trim();
	}

	/**
	 * Lista todas las terminales Point (físicas o de sandbox) vinculadas a la cuenta de Mercado Pago del comercio.
	 */
	static async listPointDevices(models: TenantModels): Promise<IPointDevice[]> {
		const accessToken = await this.getAccessToken(models);

		try {
			// 1. Intentar endpoint moderno de terminales (/terminals/v1/list)
			const res = await fetch('https://api.mercadopago.com/terminals/v1/list', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});

			if (res.ok) {
				const data = await res.json();
				const terminals = data.terminals || data.data || [];
				return terminals.map((t: any) => ({
					id: t.id || t.device_id,
					name: t.name || t.pos_name || `Terminal ${t.id}`,
					operatingMode: t.operating_mode || 'PDV',
					posId: t.pos_id,
					storeId: t.store_id,
					externalId: t.external_id
				}));
			}

			// 2. Fallback a Point Integration API (/v1/point/integration-api/devices)
			const legacyRes = await fetch('https://api.mercadopago.com/v1/point/integration-api/devices', {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});

			if (legacyRes.ok) {
				const legacyData = await legacyRes.json();
				const devices = legacyData.devices || [];
				return devices.map((d: any) => ({
					id: d.id,
					name: d.name || `Point ${d.id}`,
					operatingMode: d.operating_mode || 'POINT',
					posId: d.pos_id,
					storeId: d.store_id
				}));
			}

			const errData = await res.json().catch(() => ({}));
			console.warn('[MercadoPagoPoint] No se pudieron listar terminales:', errData);
			return [];
		} catch (error: any) {
			console.error('[MercadoPagoPoint] Error al consultar terminales:', error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Error al consultar terminales Point',
				'No se pudo conectar con Mercado Pago para consultar tus terminales Point. Verificá tu conexión a internet.',
				502
			);
		}
	}

	/**
	 * Envía una orden de cobro directamente a la pantalla de la terminal Point física o de prueba.
	 */
	static async createPointOrder(
		models: TenantModels,
		params: ICreatePointOrderDTO
	): Promise<IPointOrderResponse> {
		const { deviceId, amount, orderNumber, description, printOnTerminal } = params;

		if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
			throw new AppError(
				'Terminal requerida',
				'Debés seleccionar una terminal Point para enviar el cobro.',
				400
			);
		}

		if (!amount || typeof amount !== 'number' || amount <= 0) {
			throw new AppError(
				'Monto inválido',
				'El monto a cobrar en la terminal Point debe ser mayor a $0.',
				400
			);
		}

		const accessToken = await this.getAccessToken(models);
		const externalRef = orderNumber ? String(orderNumber).trim() : `POS-${Date.now()}`;
		const descText = description ? description.trim() : `Venta Mostrador #${externalRef}`;
		const idempotencyKey = crypto.randomUUID();

		const payload = {
			type: 'point',
			external_reference: externalRef,
			total_amount: Math.round(amount * 100) / 100,
			description: descText,
			point: {
				device_id: deviceId.trim()
			},
			config: {
				point: {
					screen_time: 60,
					print_on_terminal: printOnTerminal !== false ? 'print' : 'no_print'
				}
			}
		};

		try {
			const res = await fetch('https://api.mercadopago.com/v1/orders', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
					'X-Idempotency-Key': idempotencyKey
				},
				body: JSON.stringify(payload)
			});

			const data = await res.json();

			if (!res.ok) {
				const errorMsg = (data.message || data.error || '').toLowerCase();
				const details = JSON.stringify(data);

				console.error(`[MercadoPagoPoint] Error al crear orden en terminal: HTTP ${res.status}`, details);

				if (errorMsg.includes('busy') || errorMsg.includes('in_progress') || errorMsg.includes('active_order')) {
					throw new AppError(
						'Terminal Point ocupada',
						'La terminal Point se encuentra ocupada con otra transacción. Esperá a que termine o cancelala en el aparato.',
						409
					);
				}

				if (errorMsg.includes('device') || errorMsg.includes('not_found') || res.status === 404) {
					throw new AppError(
						'Terminal Point no encontrada',
						`La terminal con ID "${deviceId}" no existe o fue desvinculada de tu cuenta de Mercado Pago.`,
						404
					);
				}

				if (errorMsg.includes('offline') || errorMsg.includes('disconnected')) {
					throw new AppError(
						'Terminal Point desconectada',
						'La terminal Point está apagada o sin internet. Verificá que tenga batería y señal Wi-Fi/4G.',
						503
					);
				}

				throw new AppError(
					'Error al enviar cobro al Posnet',
					data.message || 'Mercado Pago no pudo enviar el cobro a la terminal. Verificá que el aparato esté encendido.',
					res.status >= 400 && res.status < 500 ? res.status : 502
				);
			}

			return {
				orderId: data.id || data.order_id,
				status: data.status || 'at_terminal',
				deviceId: data.point?.device_id || deviceId,
				totalAmount: data.total_amount || amount,
				externalReference: data.external_reference || externalRef,
				createdAt: data.created_date || new Date().toISOString()
			};
		} catch (error: any) {
			if (error instanceof AppError) throw error;
			console.error('[MercadoPagoPoint] Excepción en createPointOrder:', error);
			throw new AppError(
				'Fallo de comunicación con la terminal',
				'Ocurrió un error inesperado al conectar con el servidor de Mercado Pago.',
				500
			);
		}
	}

	/**
	 * Consulta el estado en tiempo real de una orden enviada a la terminal Point.
	 */
	static async getPointOrderStatus(models: TenantModels, orderId: string): Promise<IPointOrderResponse> {
		if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
			throw new AppError('Order ID requerido', 'El identificador de la orden de pago es obligatorio.', 400);
		}

		const accessToken = await this.getAccessToken(models);

		try {
			const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId.trim())}`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});

			const data = await res.json();

			if (!res.ok) {
				console.error(`[MercadoPagoPoint] Error al consultar orden ${orderId}:`, data);
				throw new AppError(
					'Orden no encontrada',
					'No se pudo encontrar la orden de pago en Mercado Pago.',
					res.status === 404 ? 404 : 502
				);
			}

			// Extraer detalles del pago si ya fue procesado o aprobado
			let paymentDetails: IPointOrderResponse['paymentDetails'] = undefined;
			if (data.payments && data.payments.length > 0) {
				const lastPayment = data.payments[data.payments.length - 1];
				paymentDetails = {
					paymentId: String(lastPayment.id || ''),
					status: lastPayment.status || '',
					paymentMethodId: lastPayment.payment_method_id || '',
					paymentTypeId: lastPayment.payment_type_id || '',
					cardLastFourDigits: lastPayment.card?.last_four_digits || ''
				};
			}

			return {
				orderId: data.id,
				status: data.status, // 'created' | 'at_terminal' | 'processed' | 'failed' | 'cancelled'
				deviceId: data.point?.device_id || '',
				totalAmount: data.total_amount || 0,
				externalReference: data.external_reference || '',
				createdAt: data.created_date || '',
				paymentDetails
			};
		} catch (error: any) {
			if (error instanceof AppError) throw error;
			console.error('[MercadoPagoPoint] Excepción en getPointOrderStatus:', error);
			throw new AppError(
				'Error consultando estado de la terminal',
				'No se pudo verificar el estado del pago con Mercado Pago.',
				500
			);
		}
	}

	/**
	 * Cancela la orden activa en la terminal Point (apaga la pantalla de cobro del aparato).
	 */
	static async cancelPointOrder(models: TenantModels, orderId: string): Promise<{ success: boolean; message: string }> {
		if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
			throw new AppError('Order ID requerido', 'El identificador de la orden de pago es obligatorio.', 400);
		}

		const accessToken = await this.getAccessToken(models);

		try {
			const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId.trim())}/cancel`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				console.warn(`[MercadoPagoPoint] No se pudo cancelar orden ${orderId}:`, data);
				// Si ya fue cerrada, cancelada o pagada, devolver mensaje amigable
				const msg = (data.message || '').toLowerCase();
				if (msg.includes('closed') || msg.includes('cannot be cancelled')) {
					return {
						success: false,
						message: 'La orden ya fue finalizada o procesada por la terminal.'
					};
				}
			}

			return {
				success: true,
				message: 'Orden cancelada exitosamente en la terminal Point.'
			};
		} catch (error: any) {
			if (error instanceof AppError) throw error;
			console.error('[MercadoPagoPoint] Excepción en cancelPointOrder:', error);
			throw new AppError(
				'Error al cancelar cobro en la terminal',
				'No se pudo cancelar el cobro en la terminal Point.',
				500
			);
		}
	}
}
