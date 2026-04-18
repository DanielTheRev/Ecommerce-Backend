import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth';
import { AddressService } from '@/services/address.service';

export class AddressController {
	static async getUserAddresses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const addressService = new AddressService(req.models);
			const addresses = await addressService.getUserAddresses(req.user!._id);
			res.status(200).json({ success: true, count: addresses.length, data: addresses });
		} catch (error) {
			next(error);
		}
	}

	static async getAddressById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const addressService = new AddressService(req.models);
			const address = await addressService.getAddressById(req.params.id, req.user!._id);
			res.status(200).json({ success: true, data: address });
		} catch (error) {
			next(error);
		}
	}

	static async createAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const addressService = new AddressService(req.models);
			const address = await addressService.createAddress(req.user!._id, req.body);
			res.status(201).json({ success: true, data: address });
		} catch (error) {
			next(error);
		}
	}

	static async updateAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const addressService = new AddressService(req.models);
			const address = await addressService.updateAddress(req.params.id, req.user!._id, req.body);
			res.status(200).json({ success: true, data: address });
		} catch (error) {
			next(error);
		}
	}

	static async deleteAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const addressService = new AddressService(req.models);
			await addressService.deleteAddress(req.params.id, req.user!._id);
			res.status(200).json({ success: true, data: {} });
		} catch (error) {
			next(error);
		}
	}
}
