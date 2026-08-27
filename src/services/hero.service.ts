import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IHeroCreateDTO, IHeroSlide } from '@/interfaces/hero.interface';
import { ImageService } from './images.service';

export class HeroService {
  static async create(models: TenantModels, data: IHeroCreateDTO, tenantSlug?: string) {
    if (!tenantSlug) throw new AppError('No tenant slug provider for HeroService.create', 'Error interno del servidor, disculpas.', 500);

    const desktopImage1 = data.imageFiles?.['imageDesktop1'] ? data.imageFiles['imageDesktop1'][0] : undefined;
    const desktopImage2 = data.imageFiles?.['imageDesktop2'] ? data.imageFiles['imageDesktop2'][0] : undefined;
    const mobileImage1 = data.imageFiles?.['imageMobile1'] ? data.imageFiles['imageMobile1'][0] : undefined;
    const mobileImage2 = data.imageFiles?.['imageMobile2'] ? data.imageFiles['imageMobile2'][0] : undefined;

    const slidesCount = await models.HeroSlide.countDocuments();

    const finalDesktop1Source = data.imageDesktop1 || desktopImage1;
    const finalDesktop2Source = data.imageDesktop2 || desktopImage2;
    const finalMobile1Source = data.imageMobile1 || mobileImage1;
    const finalMobile2Source = data.imageMobile2 || mobileImage2;

    if (!finalDesktop1Source || !finalMobile1Source) {
      throw new AppError('No images for Slide', 'No se proporcionaron las imágenes principales (Desktop1 y Mobile1) para el slide', 400);
    }

    const rawImages: any[] = [];
    if (finalDesktop1Source) rawImages.push({ id: `slide-${slidesCount + 1}-desktop1`, source: finalDesktop1Source, field: 'imageDesktop1' });
    if (finalDesktop2Source) rawImages.push({ id: `slide-${slidesCount + 1}-desktop2`, source: finalDesktop2Source, field: 'imageDesktop2' });
    if (finalMobile1Source) rawImages.push({ id: `slide-${slidesCount + 1}-mobile1`, source: finalMobile1Source, field: 'imageMobile1' });
    if (finalMobile2Source) rawImages.push({ id: `slide-${slidesCount + 1}-mobile2`, source: finalMobile2Source, field: 'imageMobile2' });

    const uploadResults = await ImageService.UploadImages(rawImages, `${tenantSlug}/slide-images`);

    const slidePayload: any = {
      ...data,
      featuredProducts: data.featuredProducts ? JSON.parse(data.featuredProducts) : [],
    };

    rawImages.forEach((img, index) => {
      slidePayload[img.field] = uploadResults[index];
    });

    const created = await models.HeroSlide.create(slidePayload);
    const { CacheService } = await import('./cache.service');
    CacheService.invalidatePrefix(tenantSlug, 'hero');
    CacheService.invalidatePrefix(tenantSlug, 'home');
    return created;
  }

  static async getById(models: TenantModels, id: string): Promise<IHeroSlide> {
    try {
      if (!id) throw new AppError('slide not found', 'slide no encontrado', 404);
      const slide = await models.HeroSlide.findById(id).populate('featuredProducts').lean() as unknown as IHeroSlide;
      if (!slide) throw new AppError('slide not found', 'slide no encontrado', 404);
      return slide;
    } catch (error) {
      console.log(error);
      throw new AppError('Error while getting slide', 'Error al obtener slide', 500);
    }
  }

  static async getAll(models: TenantModels) {
    try {
      const slides = await models.HeroSlide.find().sort({ order: 1 });
      return slides;
    } catch (error) {
      throw new AppError('Error while getting slides', 'Error al obtener slides', 500);
    }
  }

  static async getActiveSlides(models: TenantModels, tenantSlug?: string) {
    try {
      const cacheKey = 'hero:active';
      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        const cached = CacheService.get<IHeroSlide[]>(tenantSlug, cacheKey);
        if (cached) return cached;
      }

      const slides = await models.HeroSlide.find({ isActive: true }) as unknown as IHeroSlide[];

      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        CacheService.set(tenantSlug, cacheKey, slides, 10 * 60 * 1000);
      }

      return slides;
    } catch (error) {
      throw new AppError('Error while getting slides', 'Error al obtener slides', 500);
    }
  }

  static async update(models: TenantModels, id: string, data: Partial<IHeroSlide> & { imageFiles?: { [fieldname: string]: Express.Multer.File[] }, imageDesktop1?: string, imageDesktop2?: string, imageMobile1?: string, imageMobile2?: string, featuredProducts?: any }, tenantSlug?: string) {
    if (!tenantSlug) throw new AppError('No tenant slug provider for HeroService.update', 'Error interno del servidor, disculpas.', 500);
    if (!id || !data) throw new AppError('slide not found', 'slide no encontrado', 404);
    
    try {
      const slideToUpdate = await models.HeroSlide.findById(id).lean() as unknown as IHeroSlide;
      if (!slideToUpdate) throw new AppError('slide not found', 'slide no encontrado', 404);

      const slidePayload: any = { ...data };
      if (data.featuredProducts && typeof data.featuredProducts === 'string') {
        slidePayload.featuredProducts = JSON.parse(data.featuredProducts);
      }

      const fileFields = ['imageDesktop1', 'imageDesktop2', 'imageMobile1', 'imageMobile2'] as const;
      const rawImages: any[] = [];

      for (const field of fileFields) {
        const file = data.imageFiles?.[field] ? data.imageFiles[field][0] : undefined;
        const sourceStr = typeof data[field] === 'string' ? data[field] : undefined;
        const finalSource = sourceStr || file;

        if (finalSource) {
          rawImages.push({
            id: `slide-${id}-${field}Update-${Date.now()}`,
            source: finalSource,
            field
          });
        }
      }

      if (rawImages.length > 0) {
        const uploadResults = await ImageService.UploadImages(rawImages, `${tenantSlug}/slide-images`);
        
        for (let i = 0; i < rawImages.length; i++) {
          const field = rawImages[i].field as keyof IHeroSlide;
          slidePayload[field] = uploadResults[i];
          
          const oldImage = slideToUpdate[field] as any;
          if (oldImage?.public_id) {
            await ImageService.DeleteImage(oldImage.public_id).catch(err => console.error(`Failed to delete old ${field} image:`, err));
          }
        }
      }

      delete slidePayload.imageFiles;

      const fieldsToSelect = Object.keys(slidePayload).join(' ');
      const slide = await models.HeroSlide.findByIdAndUpdate(id, slidePayload, { new: true, runValidators: true, select: fieldsToSelect }).lean() as unknown as IHeroSlide;
      if (!slide) throw new AppError('slide not found', 'slide no encontrado', 404);

      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        CacheService.invalidatePrefix(tenantSlug, 'hero');
        CacheService.invalidatePrefix(tenantSlug, 'home');
      }

      return slide;
    } catch (error) {
      throw error;
    }
  }

  static async delete(models: TenantModels, id: string, tenantSlug?: string) {
    try {
      const slide = await models.HeroSlide.findById(id).lean() as unknown as IHeroSlide;
      if (!slide) throw new AppError('slide not found', 'slide no encontrado', 404);

      const fileFields = ['imageDesktop1', 'imageDesktop2', 'imageMobile1', 'imageMobile2'] as const;
      for (const field of fileFields) {
        const image = slide[field] as any;
        if (image?.public_id) {
          await ImageService.DeleteImage(image.public_id).catch(err => console.error(`Failed to delete ${field} image:`, err));
        }
      }

      await models.HeroSlide.findByIdAndDelete(id);

      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        CacheService.invalidatePrefix(tenantSlug, 'hero');
        CacheService.invalidatePrefix(tenantSlug, 'home');
      }

      return slide;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error while deleting slide', 'Error al eliminar slide', 500);
    }
  }
}
