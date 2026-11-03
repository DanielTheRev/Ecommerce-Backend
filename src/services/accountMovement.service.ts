import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import {
	AccountMovementType,
	AccountPaymentMethod,
	IAccountMovementDocument,
	RecordPaymentDTO,
	RecordAdjustmentDTO,
	UpdateCreditLimitDTO,
	DebtorSummaryItem
} from '@/interfaces/accountMovement.interface';
import { Role } from '@/interfaces/user.interface';
import { realtimeService } from '@/sockets/realtime.service';

export class AccountMovementService {
	/**
	 * Registra un cargo por compra fiada / a cuenta corriente (habitualmente desde mostrador POS).
	 */
	static async recordCharge(
		models: TenantModels,
		clientId: string,
		amount: number,
		orderId: string,
		createdBy: string,
		notes?: string
	): Promise<{ movement: IAccountMovementDocument; currentBalance: number }> {
		if (amount <= 0) {
			throw new AppError('Monto inválido', 'El monto del cargo debe ser mayor a 0', 400);
		}

		const client = await models.User.findById(clientId);
		if (!client) {
			throw new AppError('Cliente no encontrado', 'El cliente seleccionado no existe', 404);
		}

		const currentAccount = client.currentAccount || {
			balance: 0,
			creditLimit: 0,
			isCreditAllowed: true
		};

		if (!currentAccount.isCreditAllowed) {
			throw new AppError(
				'Crédito suspendido',
				`El cliente "${client.name} ${client.lastName || ''}".trim() tiene suspendida la cuenta corriente / fiado`,
				400
			);
		}

		const currentBalance = currentAccount.balance || 0;
		const creditLimit = currentAccount.creditLimit || 0;
		const newBalance = currentBalance + amount;

		if (creditLimit > 0 && newBalance > creditLimit) {
			throw new AppError(
				'Límite de crédito superado',
				`El cargo de $${amount} supera el límite de crédito disponible. Saldo actual: $${currentBalance}, Límite: $${creditLimit}, Saldo resultante: $${newBalance}`,
				400
			);
		}

		// Actualizar saldo del cliente
		const updatedClient = await models.User.findByIdAndUpdate(
			clientId,
			{
				$inc: { 'currentAccount.balance': amount }
			},
			{ new: true }
		);

		// Crear movimiento en el libro mayor
		const movement = await models.AccountMovement.create({
			client: clientId,
			type: AccountMovementType.CHARGE,
			amount,
			previousBalance: currentBalance,
			newBalance,
			order: orderId,
			notes: notes || 'Compra fiada en mostrador',
			createdBy
		});

		return {
			movement,
			currentBalance: updatedClient?.currentAccount?.balance || newBalance
		};
	}

	/**
	 * Registra un pago o entrega de dinero para saldar deuda (total o parcial).
	 */
	static async recordPayment(
		models: TenantModels,
		clientId: string,
		data: RecordPaymentDTO,
		createdBy: string,
		tenantSlug?: string
	): Promise<{ movement: IAccountMovementDocument; newBalance: number }> {
		if (!data.amount || data.amount <= 0) {
			throw new AppError('Monto inválido', 'El monto a abonar debe ser mayor a 0', 400);
		}

		const client = await models.User.findById(clientId);
		if (!client) {
			throw new AppError('Cliente no encontrado', 'El cliente no existe', 404);
		}

		const previousBalance = client.currentAccount?.balance || 0;
		if (previousBalance <= 0) {
			throw new AppError('Sin deuda pendiente', `El cliente "${client.name}" no registra saldo deudor pendiente`, 400);
		}

		// Si el pago excede la deuda, se cancela la deuda y se deja en 0
		const actualPayment = Math.min(data.amount, previousBalance);
		const newBalance = Math.max(0, previousBalance - actualPayment);

		// Si el pago es en efectivo y hay una caja registradora abierta provista,
		// verificamos que la caja esté abierta
		if (data.paymentMethod === AccountPaymentMethod.CASH && data.cashRegisterId) {
			const cashRegister = await models.CashRegister.findById(data.cashRegisterId);
			if (!cashRegister || cashRegister.status !== 'OPEN') {
				throw new AppError('Caja cerrada', 'La caja registradora seleccionada no se encuentra abierta', 400);
			}
		}

		// Actualizar saldo del cliente
		const updatedClient = await models.User.findByIdAndUpdate(
			clientId,
			{
				$set: { 'currentAccount.balance': newBalance }
			},
			{ new: true }
		);

		// Crear movimiento
		const movement = await models.AccountMovement.create({
			client: clientId,
			type: AccountMovementType.PAYMENT,
			amount: actualPayment,
			previousBalance,
			newBalance,
			cashRegister: data.cashRegisterId,
			paymentMethod: data.paymentMethod,
			notes: data.notes || (newBalance === 0 ? 'Cancelación total de deuda' : 'Entrega a cuenta de fiado'),
			createdBy
		});

		// Notificar en tiempo real al panel
		if (tenantSlug) {
			realtimeService.notifyAdminAlert(
				'Cobro de Cuenta Corriente',
				`Se registró un pago de $${actualPayment} de ${client.name} ${client.lastName || ''}. Saldo restante: $${newBalance}`,
				undefined,
				tenantSlug
			);
		}

		return {
			movement,
			newBalance: updatedClient?.currentAccount?.balance ?? newBalance
		};
	}

	/**
	 * Registra un ajuste manual de saldo (para correcciones contables o condonaciones acordadas).
	 */
	static async recordAdjustment(
		models: TenantModels,
		clientId: string,
		data: RecordAdjustmentDTO,
		createdBy: string
	): Promise<{ movement: IAccountMovementDocument; newBalance: number }> {
		if (data.newBalance < 0) {
			throw new AppError('Saldo inválido', 'El saldo resultante no puede ser negativo', 400);
		}
		if (!data.reason || !data.reason.trim()) {
			throw new AppError('Motivo requerido', 'Debes ingresar el motivo del ajuste de saldo', 400);
		}

		const client = await models.User.findById(clientId);
		if (!client) {
			throw new AppError('Cliente no encontrado', 'El cliente no existe', 404);
		}

		const previousBalance = client.currentAccount?.balance || 0;
		const newBalance = data.newBalance;
		const amount = Math.abs(newBalance - previousBalance);

		await models.User.findByIdAndUpdate(clientId, {
			$set: { 'currentAccount.balance': newBalance }
		});

		const movement = await models.AccountMovement.create({
			client: clientId,
			type: AccountMovementType.ADJUSTMENT,
			amount,
			previousBalance,
			newBalance,
			notes: `Ajuste manual: ${data.reason.trim()}`,
			createdBy
		});

		return { movement, newBalance };
	}

	/**
	 * Configura el límite de crédito o habilita/suspende el fiado para un cliente.
	 */
	static async updateCreditConfig(
		models: TenantModels,
		clientId: string,
		data: UpdateCreditLimitDTO
	) {
		const updateFields: any = {};
		if (typeof data.creditLimit === 'number') {
			if (data.creditLimit < 0) {
				throw new AppError('Límite inválido', 'El límite de crédito no puede ser negativo', 400);
			}
			updateFields['currentAccount.creditLimit'] = data.creditLimit;
		}

		if (typeof data.isCreditAllowed === 'boolean') {
			updateFields['currentAccount.isCreditAllowed'] = data.isCreditAllowed;
		}

		const client = await models.User.findByIdAndUpdate(
			clientId,
			{ $set: updateFields },
			{ new: true }
		).select('name lastName email phone currentAccount');

		if (!client) {
			throw new AppError('Cliente no encontrado', 'El cliente no existe', 404);
		}

		return client;
	}

	/**
	 * Retorna la ficha de cuenta corriente de un cliente con su saldo y movimientos históricos.
	 */
	static async getClientAccountSummary(
		models: TenantModels,
		clientId: string,
		page: number = 1,
		limit: number = 30
	) {
		const client = await models.User.findById(clientId).select(
			'name lastName email phone dni currentAccount createdAt'
		);

		if (!client) {
			throw new AppError('Cliente no encontrado', 'El cliente no existe', 404);
		}

		const skip = (Math.max(1, page) - 1) * limit;

		const [movements, totalMovements] = await Promise.all([
			models.AccountMovement.find({ client: clientId })
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate('order', 'orderNumber total status createdAt')
				.populate('createdBy', 'name lastName email')
				.lean(),
			models.AccountMovement.countDocuments({ client: clientId })
		]);

		return {
			client: {
				_id: client._id,
				name: client.name,
				lastName: client.lastName,
				email: client.email,
				phone: client.phone,
				dni: client.dni,
				currentAccount: client.currentAccount || {
					balance: 0,
					creditLimit: 0,
					isCreditAllowed: true
				}
			},
			movements,
			pagination: {
				total: totalMovements,
				page,
				pages: Math.ceil(totalMovements / limit) || 1,
				limit
			}
		};
	}

	/**
	 * Retorna el resumen global de deudores ("Plata en la calle") para el dueño o cajero.
	 */
	static async getDebtorsSummary(
		models: TenantModels,
		search?: string
	): Promise<{
		totalDebt: number;
		debtorCount: number;
		debtors: DebtorSummaryItem[];
	}> {
		const query: any = {
			role: Role.user,
			'currentAccount.balance': { $gt: 0 }
		};

		if (search && search.trim()) {
			const clean = search.trim();
			query.$or = [
				{ name: { $regex: clean, $options: 'i' } },
				{ lastName: { $regex: clean, $options: 'i' } },
				{ phone: { $regex: clean, $options: 'i' } },
				{ dni: { $regex: clean, $options: 'i' } }
			];
		}

		const debtorsRaw = await models.User.find(query)
			.select('name lastName phone email currentAccount updatedAt')
			.sort({ 'currentAccount.balance': -1 })
			.lean();

		const totalDebt = debtorsRaw.reduce(
			(acc, d) => acc + (d.currentAccount?.balance || 0),
			0
		);

		const debtors: DebtorSummaryItem[] = debtorsRaw.map((d) => ({
			_id: d._id.toString(),
			name: d.name,
			lastName: d.lastName,
			phone: d.phone,
			email: d.email,
			balance: d.currentAccount?.balance || 0,
			creditLimit: d.currentAccount?.creditLimit || 0,
			isCreditAllowed: d.currentAccount?.isCreditAllowed ?? true,
			lastMovementDate: d.updatedAt
		}));

		return {
			totalDebt,
			debtorCount: debtors.length,
			debtors
		};
	}

	/**
	 * Genera el texto y enlace formateado para enviar recordatorio de cobro por WhatsApp.
	 */
	static async getWhatsAppReminder(
		models: TenantModels,
		clientId: string,
		storeName: string = 'el comercio'
	): Promise<{ phone: string; message: string; waLink: string }> {
		const client = await models.User.findById(clientId);
		if (!client) {
			throw new AppError('Cliente no encontrado', 'El cliente no existe', 404);
		}

		const rawPhone = (client.phone || '').replace(/[^0-9]/g, '');
		if (!rawPhone) {
			throw new AppError('Teléfono no registrado', 'El cliente no tiene un teléfono válido registrado', 400);
		}

		// Normalizar teléfono argentino para WhatsApp (agregar 549 si falta código de país)
		let cleanPhone = rawPhone;
		if (cleanPhone.startsWith('15') && cleanPhone.length === 10) {
			cleanPhone = '549' + cleanPhone.slice(2);
		} else if (cleanPhone.length === 10) {
			cleanPhone = '549' + cleanPhone;
		} else if (!cleanPhone.startsWith('54') && cleanPhone.length <= 11) {
			cleanPhone = '549' + cleanPhone;
		}

		const balance = client.currentAccount?.balance || 0;
		const clientName = client.name;

		const message = `¡Hola ${clientName}! 👋 Te escribimos de ${storeName}. Te recordamos que al día de hoy tenés un saldo pendiente en tu cuenta corriente de $${balance.toLocaleString('es-AR')}. Podés pasar a abonar en el local o consultarnos por transferencia. ¡Muchas gracias!`;

		const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

		return {
			phone: cleanPhone,
			message,
			waLink
		};
	}
}
