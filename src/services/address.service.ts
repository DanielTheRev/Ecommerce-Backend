import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import { IAddress, ICreateAddressDTO, IUpdateAddressDTO } from '@/interfaces/address.interface';

export class AddressService {
	constructor(private models: TenantModels) {}

	async getUserAddresses(userId: string): Promise<IAddress[]> {
		const addresses = await this.models.Address.find({ user: userId }).sort({ createdAt: -1 }).lean().exec();
		// Convertir a objeto plano que cumple con IAddress
		return addresses.map((addr) => ({ 
			...addr, 
			_id: addr._id.toString() 
		})) as unknown as IAddress[];
	}

	async getAddressById(addressId: string, userId: string): Promise<IAddress> {
		const address = await this.models.Address.findOne({ _id: addressId, user: userId }).lean().exec();
		
		if (!address) {
			throw new AppError('Address not found', 'Dirección no encontrada', 404);
		}
		
		return { ...address, _id: address._id.toString() } as unknown as IAddress;
	}

	async createAddress(userId: string, data: ICreateAddressDTO): Promise<IAddress> {
		// Si se envía como default (o si no tiene, pero es la primera)
		if (data.isDefault) {
			await this.models.Address.updateMany({ user: userId }, { isDefault: false });
		} else {
			const count = await this.models.Address.countDocuments({ user: userId });
			if (count === 0) {
				data.isDefault = true;
			}
		}

		const newAddress = new this.models.Address({ ...data, user: userId });
		const saved = await newAddress.save();
		
		return { ...saved.toObject(), _id: saved._id.toString() } as unknown as IAddress;
	}

	async updateAddress(addressId: string, userId: string, data: IUpdateAddressDTO): Promise<IAddress> {
		if (data.isDefault) {
			await this.models.Address.updateMany(
				{ user: userId, _id: { $ne: addressId } },
				{ isDefault: false }
			);
		}

		const address = await this.models.Address.findOneAndUpdate(
			{ _id: addressId, user: userId },
			data,
			{ new: true, runValidators: true }
		).lean().exec();

		if (!address) {
			throw new AppError('Address not found', 'Dirección no encontrada', 404);
		}

		return { ...address, _id: address._id.toString() } as unknown as IAddress;
	}

	async deleteAddress(addressId: string, userId: string): Promise<void> {
		const deletedAddress = await this.models.Address.findOneAndDelete({ _id: addressId, user: userId });
		
		if (!deletedAddress) {
			throw new AppError('Address not found', 'Dirección no encontrada', 404);
		}

		// Si se eliminó la dirección por defecto, asignamos la más reciente como por defecto
		if (deletedAddress.isDefault) {
			const another = await this.models.Address.findOne({ user: userId }).sort({ createdAt: -1 });
			if (another) {
				another.isDefault = true;
				await another.save();
			}
		}
	}
}
