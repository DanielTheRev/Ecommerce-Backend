import { AppError } from '@/errors/app.error';
import { IBanner } from '@/interfaces/home.interface';
import { TenantModels } from '@/config/modelRegistry';

export class BannerService {
  static async createBanner(models: TenantModels, data: IBanner): Promise<IBanner> {
    try {
      const banner = await models.Banner.create(data);
      return banner;
    } catch (error: any) {
      console.log(error);
      if (error.code === 11000) {
        throw new AppError('Banner with this Brand Name already exists', 'Ya existe un banner para esta marca', 400);
      }
      throw new AppError('Error creating banner', 'Error al crear el banner', 500);
    }
  }

  static async getAllBanners(models: TenantModels): Promise<IBanner[]> {
    try {
      return await models.Banner.find().sort({ order: 1 });
    } catch (error) {
      throw new AppError('Error fetching banners', 'Error al obtener banners', 500);
    }
  }

  static async getActiveBanners(models: TenantModels): Promise<IBanner[]> {
    try {
      return await models.Banner.find({ isActive: true }).sort({ order: 1 });
    } catch (error) {
      throw new AppError('Error fetching active banners', 'Error al obtener banners activos', 500);
    }
  }

  static async getBannerById(models: TenantModels, id: string): Promise<IBanner> {
    try {
      const banner = await models.Banner.findById(id);
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error fetching banner', 'Error al obtener el banner', 500);
    }
  }

  static async updateBanner(models: TenantModels, id: string, data: Partial<IBanner>): Promise<IBanner> {
    try {
      if (!id || !data) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      const fieldsToSelect = Object.keys(data).join(' ');
      const banner = await models.Banner.findByIdAndUpdate(id, data, { new: true, runValidators: true, select: fieldsToSelect }).lean();
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error updating banner', 'Error al actualizar el banner', 500);
    }
  }

  static async deleteBanner(models: TenantModels, id: string): Promise<IBanner> {
    try {
      const banner = await models.Banner.findByIdAndDelete(id);
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error deleting banner', 'Error al eliminar el banner', 500);
    }
  }
}
