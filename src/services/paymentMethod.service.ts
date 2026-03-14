import { AppError } from '@/errors/app.error';
import { IPaymentMethod, IPaymentMethodQuery } from '@/interfaces/paymentMethod.interface';
import { TenantModels } from '@/config/modelRegistry';

export class PaymentMethodService {

	static async getPaymentMethods(models: TenantModels): Promise<IPaymentMethod[]> {
		try {
			const paymentMethods = await models.PaymentMethod.find().lean();
			return paymentMethods;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve payment methods',
				'Error al recuperar los métodos de pago',
				500
			);
		}
	}

	static async getPaymentMethodBy(models: TenantModels, query: IPaymentMethodQuery): Promise<IPaymentMethod> {
		try {
			const paymentMethod = await models.PaymentMethod.findOne(query).lean();
			if (!paymentMethod)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			return paymentMethod;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve payment method',
				'Error al recuperar el método de pago',
				500
			);
		}
	}

	static async getPaymentMethodsBy(models: TenantModels, query: IPaymentMethodQuery): Promise<IPaymentMethod[]> {
		try {
			const paymentMethods = await models.PaymentMethod.find(query).lean() as IPaymentMethod[];
			if (!paymentMethods)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			return paymentMethods;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve payment methods',
				'Error al recuperar los métodos de pago',
				500
			);
		}
	}

	static async getPaymentMethodById(models: TenantModels, id: string): Promise<IPaymentMethod> {
		try {
			const paymentMethod = await models.PaymentMethod.findById(id).lean();
			if (!paymentMethod)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			return paymentMethod;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError(
				'Failed to retrieve payment method',
				'Error al recuperar el método de pago',
				500
			);
		}
	}

	static async create(models: TenantModels, data: IPaymentMethod): Promise<IPaymentMethod> {

		try {
			const newPaymentMethod = models.PaymentMethod.create(data);
			return newPaymentMethod;
		} catch (error) {
			throw new AppError(
				'Failed to create payment method',
				'Error al crear el método de pago',
				500
			);
		}
	}

	static async update(models: TenantModels, id: string, data: Partial<IPaymentMethod>): Promise<IPaymentMethod> {
		try {
			if (!id || !data) throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);

			const fieldsToSelect = Object.keys(data).join(' ');

			const updatedPaymentMethod = await models.PaymentMethod.findByIdAndUpdate(id, data, { new: true, runValidators: true, select: fieldsToSelect });

			if (!updatedPaymentMethod)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);

			return updatedPaymentMethod;
		} catch (error) {
			throw new AppError(
				'Failed to update payment method',
				'Error al actualizar el método de pago',
				500
			);
		}
	}

	static async delete(models: TenantModels, id: string): Promise<IPaymentMethod> {
		try {
			if (!id) throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			const deletedPaymentMethod = await models.PaymentMethod.findByIdAndDelete(id);

			if (!deletedPaymentMethod)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);

			return deletedPaymentMethod;
		} catch (error) {
			throw new AppError(
				'Failed to delete payment method',
				'Error al eliminar el método de pago',
				500
			);
		}
	}
}
