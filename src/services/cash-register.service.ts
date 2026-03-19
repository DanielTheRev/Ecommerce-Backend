import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { CashRegisterStatus, ICashRegisterDocument } from '@/interfaces/cash-register.interface';
import { OrderService } from './order.service';

export class CashRegisterService {
	static async openRegister(models: TenantModels, userId: string, initialBalance: number): Promise<ICashRegisterDocument> {
		try {
			// Check if already open
			const existingRegister = await models.CashRegister.findOne({
				status: CashRegisterStatus.OPEN
			});

			if (existingRegister) {
				throw new AppError(
					'Cash register is already open',
					'La caja ya se encuentra abierta',
					400
				);
			}

			const newRegister = await models.CashRegister.create({
				openedBy: userId,
				initialBalance,
				status: CashRegisterStatus.OPEN
			});

			return newRegister;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to open cash register',
				'Error al intentar abrir la caja registradora',
				500
			);
		}
	}

	static async getCurrentRegister(models: TenantModels, userId: string): Promise<ICashRegisterDocument> {
		try {
			let register = await models.CashRegister.findOne({
				status: CashRegisterStatus.OPEN
			}).populate('openedBy', 'name email');

			if (!register) {
				// throw new AppError('No open cash register found', 'No se encontró una caja abierta', 500);
				return null as any
			}

			// Pre-calcular balance esperado con las ventas diarias desde que se abrió
			const stats = await OrderService.getDailyStats(models, new Date().toISOString());

			if (stats) {
				// Tomar solo el efectivo para el cálculo del cierre de caja
				const cashEarned = stats.revenueByMethod?.CASH || 0;
				// Nota: Si hubo ventas en efectivo antes de abrir la caja, este cálculo simple puede mezclarlos.
				// Para más precisión, getDailyStats debería poder recibir `{ fromDate: register.openedAt }`.
				// Por ahora nos mantenemos con el cálculo diario (suponiendo 1 cierre por día).

				register.calculatedCloseBalance = register.initialBalance + cashEarned;
			} else {
				register.calculatedCloseBalance = register.initialBalance;
			}

			return register;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to get current cash register',
				'Error al intentar obtener la caja actual',
				500
			);
		}
	}

	static async closeRegister(
		models: TenantModels,
		userId: string,
		actualCloseBalance: number,
		notes?: string
	): Promise<ICashRegisterDocument> {
		try {
			const register = await this.getCurrentRegister(models, userId);

			// Actualizar los campos
			register.closedAt = new Date();
			register.closedBy = userId as any;
			register.actualCloseBalance = actualCloseBalance;
			// calculte difference between what is in the drawer and what ought to be
			register.difference = actualCloseBalance - (register.calculatedCloseBalance || 0);
			register.notes = notes;
			register.status = CashRegisterStatus.CLOSED;

			await register.save();
			return register;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to close cash register',
				'Error al intentar cerrar la caja registradora',
				500
			);
		}
	}
}
