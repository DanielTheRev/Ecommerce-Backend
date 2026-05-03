import { AppError } from '@/errors/app.error';
import { IBanner } from '@/interfaces/home.interface';
import { TenantModels } from '@/config/modelRegistry';
import { ImageService } from './images.service';

export class BannerService {
  static async createBanner(models: TenantModels, data: IBanner & { imageFile?: Express.Multer.File }, tenantSlug?: string): Promise<IBanner> {
    if (!tenantSlug) throw new AppError('No tenant slug provided', 'Error interno del servidor', 500);
    
    const finalSource = data.imageFile || data.image;
    if (!finalSource) {
      throw new AppError('No image provided', 'No se proporcionó imagen para el banner', 400);
    }

    try {
      const bannerCount = await models.Banner.countDocuments();
      const imageId = `banner-${bannerCount + 1}-${Date.now()}`;
      
      const img_uploaded = await ImageService.UploadImage(finalSource, imageId, `${tenantSlug}/banner-images`);
      
      const bannerPayload = { ...data, image: img_uploaded.secure_url };
      delete bannerPayload.imageFile;

      const banner = await models.Banner.create(bannerPayload);
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

  static async updateBanner(models: TenantModels, id: string, data: Partial<IBanner> & { imageFile?: Express.Multer.File }, tenantSlug?: string): Promise<IBanner> {
    if (!tenantSlug) throw new AppError('No tenant slug provided', 'Error interno del servidor', 500);
    try {
      if (!id || !data) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      
      const bannerPayload: any = { ...data };
      
      if (data.imageFile) {
        const imageId = `banner-${id}-update-${Date.now()}`;
        const img_uploaded = await ImageService.UploadImage(data.imageFile, imageId, `${tenantSlug}/banner-images`);
        bannerPayload.image = img_uploaded.secure_url;
      } else if (data.image && typeof data.image === 'string' && data.image.startsWith('data:')) {
        const imageId = `banner-${id}-update-${Date.now()}`;
        const img_uploaded = await ImageService.UploadImage(data.image, imageId, `${tenantSlug}/banner-images`);
        bannerPayload.image = img_uploaded.secure_url;
      }

      delete bannerPayload.imageFile;

      const fieldsToSelect = Object.keys(bannerPayload).join(' ');
      const banner = await models.Banner.findByIdAndUpdate(id, bannerPayload, { new: true, runValidators: true, select: fieldsToSelect }).lean();
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
