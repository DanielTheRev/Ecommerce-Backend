import { AppError } from '@/errors/app.error';
import { IPaymentMethod, IPaymentMethodDocument, IPaymentMethodQuery } from '@/interfaces/paymentMethod.interface';
import { PaymentMethod } from '@/models/PaymentMethod.model';

export class PaymentMethodService {

	static async getPaymentMethods(): Promise<IPaymentMethod[]> {
		try {
			const paymentMethods = await PaymentMethod.find().lean();
			return paymentMethods;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve payment methods',
				'Error al recuperar los métodos de pago',
				500
			);
		}
	}

	static async getPaymentMethodBy(query: IPaymentMethodQuery): Promise<IPaymentMethod> {
		try {
			const paymentMethod = await PaymentMethod.findOne(query).lean();
			if (!paymentMethod)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			return paymentMethod;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve payment method',
				'Error al recuperar el método de pago',
				500
			);
		}
	}

	static async getPaymentMethodsBy(query: IPaymentMethodQuery): Promise<IPaymentMethod[]> {
		try {
			const paymentMethods = await PaymentMethod.find(query).lean() as IPaymentMethod[];
			if (!paymentMethods)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			return paymentMethods;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve payment methods',
				'Error al recuperar los métodos de pago',
				500
			);
		}
	}

	static async getPaymentMethodById(id: string): Promise<IPaymentMethod> {
		try {
			const paymentMethod = await PaymentMethod.findById(id).lean();
			if (!paymentMethod)
				throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			return paymentMethod;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve payment method',
				'Error al recuperar el método de pago',
				500
			);
		}
	}

	static async create(data: IPaymentMethod): Promise<IPaymentMethod> {

		try {
			const newPaymentMethod = PaymentMethod.create(data);
			return newPaymentMethod;
		} catch (error) {
			throw new AppError(
				'Failed to create payment method',
				'Error al crear el método de pago',
				500
			);
		}
	}

	static async update(id: string, data: Partial<IPaymentMethod>): Promise<IPaymentMethod> {
		try {
			if (!id || !data) throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);

			const fieldsToSelect = Object.keys(data).join(' ');

			const updatedPaymentMethod = await PaymentMethod.findByIdAndUpdate(id, data, { new: true, runValidators: true, select: fieldsToSelect });

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

	static async delete(id: string): Promise<IPaymentMethod> {
		try {
			if (!id) throw new AppError('Payment method not found', 'No se encontró el método de pago', 404);
			const deletedPaymentMethod = await PaymentMethod.findByIdAndDelete(id);

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
