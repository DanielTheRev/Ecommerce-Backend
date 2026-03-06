import { AppError } from '@/errors/app.error';
import { IShippingOption, IShippingOptionQuery, IShippingOptionUpdate } from '@/interfaces/shippingMethods.interface';
import { TenantModels } from '@/config/modelRegistry';

export class ShippingMethodService {

	static async getShippingMethods(models: TenantModels): Promise<IShippingOption[]> {
		try {
			const shippingMethods = await models.ShippingOption.find().lean() as IShippingOption[];
			return shippingMethods;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve shipping methods',
				'Error al recuperar los métodos de envío',
				500
			);
		}
	}

	static async getShippingMethodBy(models: TenantModels, query: IShippingOptionQuery): Promise<IShippingOption> {

		try {
			const shippingOptions = await models.ShippingOption.findOne(query).lean() as IShippingOption;
			return shippingOptions;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve shipping methods',
				'Error al recuperar los métodos de envío',
				500
			);
		}
	}

	static async getShippingOptionsBy(models: TenantModels, query: IShippingOptionQuery): Promise<IShippingOption[]> {

		try {
			const shippingOptions = await models.ShippingOption.find(query).lean() as IShippingOption[];
			return shippingOptions;
		} catch (error) {
			throw new AppError(
				'Failed to retrieve shipping methods',
				'Error al recuperar los métodos de envío',
				500
			);
		}
	}

	static async createShippingOption(models: TenantModels, data: IShippingOption): Promise<IShippingOption> {
		try {
			const shippingOption = await models.ShippingOption.create(data);
			return shippingOption;
		} catch (error) {
			throw new AppError(
				'Failed to create shipping option',
				'Error al crear la opción de envío',
				500
			);
		}

	}

	static async updateShippingOption(models: TenantModels, id: string, data: IShippingOptionUpdate): Promise<IShippingOption> {
		try {
			if (!id || !data)
				throw new AppError(
					'Failed to update shipping option',
					'Error al actualizar la opción de envío',
					500
				);

			const fieldsToSelect = Object.keys(data).join(' ');
			const shippingOption = await models.ShippingOption.findByIdAndUpdate(id, data, {
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

	static async deleteShippingOption(models: TenantModels, id: string): Promise<{ success: boolean }> {
		try {
			if (!id)
				throw new AppError(
					'Failed to delete shipping option',
					'Error al eliminar la opción de envío',
					500
				);
			await models.ShippingOption.findByIdAndDelete(id);
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
