import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IShopTheLookDocument, IShopTheLook } from '@/interfaces/shopTheLook.interface';
import { ImageService } from '@/services/images.service';

export class ShopTheLookService {
	static async getActiveLooks(models: TenantModels): Promise<IShopTheLookDocument[]> {
		try {
			const looks = await models.ShopTheLook.find()
				.populate('looks.hotspots.product')
				.lean();
			return looks as unknown as IShopTheLookDocument[];
		} catch (error) {
			throw new AppError('Error fetching Shop The Look items', 'Error al obtener las campañas', 500);
		}
	}

	static async getLookById(models: TenantModels, lookId: string): Promise<IShopTheLookDocument> {
		try {
			const look = await models.ShopTheLook.findById(lookId)
				.populate('looks.hotspots.product')
				.lean();
			if (!look) {
				throw new AppError('Look not found', 'Campaña no encontrada', 404);
			}
			return look as unknown as IShopTheLookDocument;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error fetching Shop The Look item', 'Error al obtener la campaña', 500);
		}
	}

	static async createLook(models: TenantModels, data: IShopTheLook): Promise<IShopTheLookDocument> {
		try {
			const newLook = await models.ShopTheLook.create(data);
			return newLook;
		} catch (error) {
			throw new AppError('Error creating Shop The Look item', 'Error al crear la campaña', 400);
		}
	}

	static async updateLook(models: TenantModels, lookId: string, data: Partial<IShopTheLook>): Promise<IShopTheLookDocument> {
		try {
			const currentLook = await models.ShopTheLook.findById(lookId).lean() as unknown as IShopTheLookDocument;
			if (!currentLook) {
				throw new AppError('Look not found', 'Campaña no encontrada', 404);
			}

			if (data.looks) {
				const oldImages = currentLook.looks.map((l: any) => l.mainImage?.public_id).filter(Boolean);
				const newImages = data.looks.map((l: any) => l.mainImage?.public_id).filter(Boolean);

				const imagesToDelete = oldImages.filter(id => !newImages.includes(id));

				for (const publicId of imagesToDelete) {
					await ImageService.DeleteImage(publicId).catch(e => console.error('Failed to delete old image', e));
				}
			}

			const updatedLook = await models.ShopTheLook.findByIdAndUpdate(
				lookId,
				{ $set: data },
				{ new: true, runValidators: true }
			).populate('looks.hotspots.product');

			return updatedLook as IShopTheLookDocument;
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error updating Shop The Look item', 'Error al actualizar la campaña', 400);
		}
	}

	static async deleteLook(models: TenantModels, lookId: string): Promise<void> {
		try {
			const currentLook = await models.ShopTheLook.findById(lookId).lean() as unknown as IShopTheLookDocument;
			if (!currentLook) {
				throw new AppError('Look not found', 'Campaña no encontrada', 404);
			}

			const imagesToDelete = currentLook.looks.map((l: any) => l.mainImage?.public_id).filter(Boolean);
			for (const publicId of imagesToDelete) {
				await ImageService.DeleteImage(publicId).catch(e => console.error('Failed to delete image', e));
			}

			await models.ShopTheLook.findByIdAndDelete(lookId);
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error deleting Shop The Look item', 'Error al eliminar la campaña', 400);
		}
	}
}
