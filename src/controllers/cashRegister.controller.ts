import { AuthRequest } from '@/middleware/auth';
import { CashRegisterService } from '@/services/cash-register.service';
import { NextFunction, Response } from 'express';

// Abrir caja
export const openRegister = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const userId = req.user!._id.toString();
		const { initialBalance } = req.body;

		const register = await CashRegisterService.openRegister(req.models!, userId, initialBalance);

		return res.status(201).json({
			message: 'Caja abierta con éxito',
			register
		});
	} catch (error) {
		return next(error);
	}
};

// Obtener estado de caja actual (sin cerrar)
export const getCurrentRegister = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const register = await CashRegisterService.getCurrentRegister(req.models!);

		return res.status(200).json({
			message: 'Estado de caja actual',
			register
		});
	} catch (error) {
		return next(error);
	}
};

// Cerrar caja
export const closeRegister = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const userId = req.user!._id.toString();
		const { actualCloseBalance, notes } = req.body;

		const register = await CashRegisterService.closeRegister(req.models!, userId, actualCloseBalance, notes);

		return res.status(200).json({
			message: 'Caja cerrada con éxito',
			register // Acá se devuelve el `difference` calculado
		});
	} catch (error) {
		return next(error);
	}
};
