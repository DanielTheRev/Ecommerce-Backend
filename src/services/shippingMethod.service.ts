import { AppError } from '@/errors/app.error';
import { IShippingOption, IShippingOptionQuery, IShippingOptionUpdate } from '@/interfaces/shippingMethods.interface';
import { ShippingOption } from '@/models/ShippingOption.model';

export class ShippingMethodService {

	static async getShippingMethods(): Promise<IShippingOption[]> {
		try {
			const shippingMethods = await ShippingOption.find().lean() as IShippingOption[];
			return shippingMethods;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve shipping methods',
				'Error al recuperar los métodos de envío',
				500
			);
		}
	}

	static async getShippingMethodBy(query: IShippingOptionQuery): Promise<IShippingOption> {

		try {
			const shippingOptions = await ShippingOption.findOne(query).lean() as IShippingOption;
			return shippingOptions;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve shipping methods',
				'Error al recuperar los métodos de envío',
				500
			);
		}
	}

	static async getShippingOptionsBy(query: IShippingOptionQuery): Promise<IShippingOption[]> {

		try {
			const shippingOptions = await ShippingOption.find(query).lean() as IShippingOption[];
			return shippingOptions;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve shipping methods',
				'Error al recuperar los métodos de envío',
				500
			);
		}
	}

	static async createShippingOption(data: IShippingOption): Promise<IShippingOption> {
		try {
			const shippingOption = await ShippingOption.create(data);
			return shippingOption;
		} catch (error) {
			throw new AppError(
				'Failed to create shipping option',
				'Error al crear la opción de envío',
				500
			);
		}

	}

	static async updateShippingOption(id: string, data: IShippingOptionUpdate): Promise<IShippingOption> {
		try {
			if (!id || !data)
				throw new AppError(
					'Failed to update shipping option',
					'Error al actualizar la opción de envío',
					500
				);

			const fieldsToSelect = Object.keys(data).join(' ');
			const shippingOption = await ShippingOption.findByIdAndUpdate(id, data, {
				new: true,
				runValidators: true,
				select: fieldsToSelect
			}).lean() as IShippingOption;

			return shippingOption;
		} catch (error) {
			throw new AppError(
				'Failed to update shipping option',
				'Error al actualizar la opción de envío',
				500
			);
		}
	}

	static async deleteShippingOption(id: string): Promise<{ success: boolean }> {
		try {
			if (!id)
				throw new AppError(
					'Failed to delete shipping option',
					'Error al eliminar la opción de envío',
					500
				);
			await ShippingOption.findByIdAndDelete(id);
			return { success: true };
		} catch (error) {
			throw new AppError(
				'Failed to delete shipping option',
				'Error al eliminar la opción de envío',
				500
			);
		}
	}

}
