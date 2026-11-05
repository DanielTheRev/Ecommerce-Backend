import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { MercadoPagoPointService } from '@/services/mercadopagoPoint.service';

export class PointController {
	/**
	 * GET /api/pos/point/devices
	 * Lista las terminales Point vinculadas a la cuenta del comercio.
	 */
	static async getDevices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const devices = await MercadoPagoPointService.listPointDevices(req.models!);
			res.status(200).json({
				success: true,
				count: devices.length,
				data: devices
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/pos/point/order
	 * Envía un cobro directo a la pantalla de la terminal Point física o de prueba.
	 */
	static async createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { deviceId, amount, orderNumber, description, printOnTerminal } = req.body;
			const result = await MercadoPagoPointService.createPointOrder(req.models!, {
				deviceId,
				amount: Number(amount),
				orderNumber,
				description,
				printOnTerminal
			});

			res.status(201).json({
				success: true,
				message: 'Cobro enviado a la terminal Point exitosamente',
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/pos/point/order/:orderId
	 * Consulta el estado en tiempo real de la orden enviada a la terminal Point.
	 */
	static async getOrderStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { orderId } = req.params;
			const result = await MercadoPagoPointService.getPointOrderStatus(req.models!, orderId);

			res.status(200).json({
				success: true,
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/pos/point/order/:orderId/cancel
	 * Cancela el cobro en la pantalla de la terminal Point.
	 */
	static async cancelOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { orderId } = req.params;
			const result = await MercadoPagoPointService.cancelPointOrder(req.models!, orderId);

			res.status(200).json({
				success: result.success,
				message: result.message
			});
		} catch (error) {
			next(error);
		}
	}
}
