import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IHeroCreateDTO, IHeroSlide } from '@/interfaces/hero.interface';
import { ImageService } from './images.service';

export class HeroService {
  static async create(models: TenantModels, data: IHeroCreateDTO, tenantSlug?: string) {
    if (!tenantSlug) throw new AppError('No tenant slug provider for HeroService.create', 'Error interno del servidor, disculpas.', 500)

    const desktopImage = data.imageFiles?.['imageDesktop'] ? data.imageFiles['imageDesktop'][0] : undefined;
    const mobileImage = data.imageFiles?.['imageMobile'] ? data.imageFiles['imageMobile'][0] : undefined;

    const slidesCount = await models.HeroSlide.countDocuments()

    const finalDesktopSource = data.imageDesktop || desktopImage;
    const finalMobileSource = data.imageMobile || mobileImage;

    if (!finalDesktopSource || !finalMobileSource) {
      throw new AppError('No images for Slide', 'No se proporcionaron imágenes para el slide', 400)
    }

    const rawImages = [
      {
        id: `slide-${slidesCount + 1}-desktopImage`,
        source: finalDesktopSource
      },
      {
        id: `slide-${slidesCount + 1}-mobileImage`,
        source: finalMobileSource
      }
    ]

    const images = await ImageService.UploadImages(rawImages, `${tenantSlug}/slide-images`)

    const [desktopUploadResult, mobileUploadResult] = images;

    const slidePayload = {
      ...data,
      featuredProducts: JSON.parse(data.featuredProducts),
      imageDesktop: desktopUploadResult,
      imageMobile: mobileUploadResult
    };


    return await models.HeroSlide.create(slidePayload);
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

  static async getActiveSlides(models: TenantModels) {
    try {
      const slides = await models.HeroSlide.find({ isActive: true }) as unknown as IHeroSlide[];
      return slides;
    } catch (error) {
      throw new AppError('Error while getting slides', 'Error al obtener slides', 500);
    }
  }

  static async update(models: TenantModels, id: string, data: Partial<IHeroSlide> & { imageFiles?: { [fieldname: string]: Express.Multer.File[] }, imageDesktop?: string, imageMobile?: string, featuredProducts?: any }, tenantSlug?: string) {
    if (!tenantSlug) throw new AppError('No tenant slug provider for HeroService.update', 'Error interno del servidor, disculpas.', 500);
    if (!id || !data) throw new AppError('slide not found', 'slide no encontrado', 404);
    console.log(data);
    try {

      const slideToUpdate = await models.HeroSlide.findById(id).lean() as unknown as IHeroSlide;
      if (!slideToUpdate) throw new AppError('slide not found', 'slide no encontrado', 404);

      const desktopImageFile = data.imageFiles?.['imageDesktop'] ? data.imageFiles['imageDesktop'][0] : undefined;
      const mobileImageFile = data.imageFiles?.['imageMobile'] ? data.imageFiles['imageMobile'][0] : undefined;

      const finalDesktopSource = typeof data.imageDesktop === 'string' ? data.imageDesktop : desktopImageFile;
      const finalMobileSource = typeof data.imageMobile === 'string' ? data.imageMobile : mobileImageFile;

      const slidePayload: any = { ...data };
      if (data.featuredProducts && typeof data.featuredProducts === 'string') {
        slidePayload.featuredProducts = JSON.parse(data.featuredProducts);
      }

      if (finalDesktopSource || finalMobileSource) {
        const rawImages: any[] = [];

        if (finalDesktopSource) {
          rawImages.push({
            id: `slide-${id}-desktopUpdate-${Date.now()}`,
            source: finalDesktopSource
          });
        }
        if (finalMobileSource) {
          rawImages.push({
            id: `slide-${id}-mobileUpdate-${Date.now()}`,
            source: finalMobileSource
          });
        }

        const images = await ImageService.UploadImages(rawImages, `${tenantSlug}/slide-images`);

        let imageIndex = 0;
        if (finalDesktopSource) {
          slidePayload.imageDesktop = images[imageIndex];
          if (slideToUpdate.imageDesktop?.public_id) {
            await ImageService.DeleteImage(slideToUpdate.imageDesktop.public_id).catch(err => console.error("Failed to delete old desktop image:", err));
          }
          imageIndex++;
        }
        if (finalMobileSource) {
          slidePayload.imageMobile = images[imageIndex];
          if (slideToUpdate.imageMobile?.public_id) {
            await ImageService.DeleteImage(slideToUpdate.imageMobile.public_id).catch(err => console.error("Failed to delete old mobile image:", err));
          }
          imageIndex++;
        }
      }

      delete slidePayload.imageFiles;

      const fieldsToSelect = Object.keys(slidePayload).join(' ');
      const slide = await models.HeroSlide.findByIdAndUpdate(id, slidePayload, { new: true, runValidators: true, select: fieldsToSelect }).lean() as unknown as IHeroSlide;
      if (!slide) throw new AppError('slide not found', 'slide no encontrado', 404);
      return slide;
    } catch (error) {
      throw error;
    }
  }

  static async delete(models: TenantModels, id: string) {
    try {
      const slide = await models.HeroSlide.findById(id).lean() as unknown as IHeroSlide;
      if (!slide) throw new AppError('slide not found', 'slide no encontrado', 404);

      if (slide.imageDesktop?.public_id) {
        await ImageService.DeleteImage(slide.imageDesktop.public_id).catch(err => console.error("Failed to delete desktop image:", err));
      }
      if (slide.imageMobile?.public_id) {
        await ImageService.DeleteImage(slide.imageMobile.public_id).catch(err => console.error("Failed to delete mobile image:", err));
      }

      await models.HeroSlide.findByIdAndDelete(id);
      return slide;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error while deleting slide', 'Error al eliminar slide', 500);
    }
  }
}
