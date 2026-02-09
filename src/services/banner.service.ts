import { AppError } from '@/errors/app.error';
import { IBanner } from '@/interfaces/home.interface';
import { Banner } from '@/models/Banner.model';

export class BannerService {
  static async createBanner(data: IBanner): Promise<IBanner> {
    try {
      const banner = await Banner.create(data);
      return banner;
    } catch (error: any) {
      console.log(error);
      if (error.code === 11000) {
        throw new AppError('Banner with this Brand Name already exists', 'Ya existe un banner para esta marca', 400);
      }
      throw new AppError('Error creating banner', 'Error al crear el banner', 500);
    }
  }

  static async getAllBanners(): Promise<IBanner[]> {
    try {
      return await Banner.find().sort({ order: 1 });
    } catch (error) {
      throw new AppError('Error fetching banners', 'Error al obtener banners', 500);
    }
  }

  static async getActiveBanners(): Promise<IBanner[]> {
    try {
      return await Banner.find({ isActive: true }).sort({ order: 1 });
    } catch (error) {
      throw new AppError('Error fetching active banners', 'Error al obtener banners activos', 500);
    }
  }

  static async getBannerById(id: string): Promise<IBanner> {
    try {
      const banner = await Banner.findById(id);
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error fetching banner', 'Error al obtener el banner', 500);
    }
  }

  static async updateBanner(id: string, data: Partial<IBanner>): Promise<IBanner> {
    try {
      if (!id || !data) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      const fieldsToSelect = Object.keys(data).join(' ');
      const banner = await Banner.findByIdAndUpdate(id, data, { new: true, runValidators: true, select: fieldsToSelect }).lean();
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error updating banner', 'Error al actualizar el banner', 500);
    }
  }

  static async deleteBanner(id: string): Promise<IBanner> {
    try {
      const banner = await Banner.findByIdAndDelete(id);
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error deleting banner', 'Error al eliminar el banner', 500);
    }
  }
}
