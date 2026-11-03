import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { AccountMovementService } from '@/services/accountMovement.service';
import { EcommerceService } from '@/services/ecommerce.service';

export class AccountMovementController {
	/**
	 * GET /api/account-movements/debtors
	 * Lista de clientes con deuda y total acumulado pendiente de cobro.
	 */
	static async getDebtors(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const search = (req.query.search as string) || undefined;
			const summary = await AccountMovementService.getDebtorsSummary(req.models!, search);

			res.status(200).json({
				success: true,
				data: summary
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/account-movements/clients/:id
	 * Detalle de la cuenta corriente y movimientos de un cliente específico.
	 */
	static async getClientAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
			const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

			const data = await AccountMovementService.getClientAccountSummary(req.models!, id, page, limit);

			res.status(200).json({
				success: true,
				data
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/account-movements/clients/:id/payments
	 * Registra un pago de cuenta corriente (entrega a cuenta o cancelación total).
	 */
	static async recordPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const tenantSlug = req.tenant?.slug;
			const createdBy = req.user!._id;

			const result = await AccountMovementService.recordPayment(
				req.models!,
				id,
				req.body,
				createdBy,
				tenantSlug
			);

			res.status(201).json({
				success: true,
				message: 'Cobro registrado exitosamente',
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * POST /api/account-movements/clients/:id/adjustments
	 * Registra un ajuste contable manual en el saldo del cliente.
	 */
	static async recordAdjustment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const createdBy = req.user!._id;

			const result = await AccountMovementService.recordAdjustment(
				req.models!,
				id,
				req.body,
				createdBy
			);

			res.status(201).json({
				success: true,
				message: 'Ajuste de saldo registrado',
				data: result
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * PATCH /api/account-movements/clients/:id/credit-config
	 * Actualiza el límite de crédito o habilita/bloquea el fiado para un cliente.
	 */
	static async updateCreditConfig(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			const client = await AccountMovementService.updateCreditConfig(req.models!, id, req.body);

			res.status(200).json({
				success: true,
				message: 'Configuración de crédito actualizada',
				data: client
			});
		} catch (error) {
			next(error);
		}
	}

	/**
	 * GET /api/account-movements/clients/:id/whatsapp-reminder
	 * Retorna el mensaje y enlace para recordatorio de cobro por WhatsApp.
	 */
	static async getWhatsAppReminder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const { id } = req.params;
			let storeName = 'el comercio';

			try {
				const config = await EcommerceService.getConfig(req.models!);
				if (config?.name) {
					storeName = config.name;
				}
			} catch (_) {}

			const reminder = await AccountMovementService.getWhatsAppReminder(req.models!, id, storeName);

			res.status(200).json({
				success: true,
				data: reminder
			});
		} catch (error) {
			next(error);
		}
	}
}
