import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IBentoConfig, IBentoConfigCreateDTO } from '@/interfaces/bento.interface';
import { IHeroImage } from '@/interfaces/hero.interface';
import { ImageService } from './images.service';

export class BentoService {
  /**
   * Obtiene la configuración de Bento
   */
  static async getBentoConfig(models: TenantModels): Promise<IBentoConfig | null> {
    try {
      const config = await models.BentoConfig.findOne().lean() as unknown as IBentoConfig;
      return config;
    } catch (error) {
      throw new AppError('Error while getting Bento config', 'Error al obtener la configuración del Bento', 500);
    }
  }

  /**
   * Crea o actualiza la configuración de Bento
   */
  static async upsertBentoConfig(models: TenantModels, tenantSlug: string, data: IBentoConfigCreateDTO) {
    if (!tenantSlug) throw new AppError('No tenant slug provider for BentoService.upsertBentoConfig', 'Error interno del servidor, disculpas.', 500);
    if (!data.blocks) throw new AppError('No blocks provided', 'Los bloques del Bento son obligatorios.', 400);

    let blocksParsed: Exclude<IBentoConfigCreateDTO['blocks'], string>;
    try {
      blocksParsed = typeof data.blocks === 'string' ? JSON.parse(data.blocks) : data.blocks;
    } catch (error) {
      throw new AppError('Invalid blocks format', 'Formato de bloques inválido', 400);
    }

    const currentConfig = await models.BentoConfig.findOne().lean() as unknown as IBentoConfig | null;

    const blockKeys = ['mainBlock', 'topRightBlock', 'bottomRightBlock', 'footerBlock'] as const;
    const rawImagesToUpload: { id: string; source: string | Express.Multer.File }[] = [];
    const uploadMap = new Map<string, { key: "mainBlock" | "topRightBlock" | "bottomRightBlock" | "footerBlock", field: 'imageDesktop' | 'imageMobile' }>();
    
    for (const key of blockKeys) {
      if (!blocksParsed[key]) {
         throw new AppError(`Missing block: ${key}`, `Falta el bloque ${key}`, 400);
      }

      const desktopFile = data.imageFiles?.[`${key}_imageDesktop`]?.[0];
      const mobileFile = data.imageFiles?.[`${key}_imageMobile`]?.[0];

      const existingDesktop = blocksParsed[key]?.imageDesktop;
      const existingMobile = blocksParsed[key]?.imageMobile;

      const hasValidDesktop = desktopFile || existingDesktop;
      if (!hasValidDesktop && !currentConfig?.blocks?.[key]?.imageDesktop) {
         throw new AppError(`No desktop image for ${key}`, `Se requiere una imagen de escritorio para el bloque ${key}`, 400);
      }

      const isDesktopUploadable = desktopFile || typeof existingDesktop === 'string';
      if (isDesktopUploadable) {
        const id = `bento-${key}-desktop-${Date.now()}`;
        rawImagesToUpload.push({ id, source: desktopFile || (existingDesktop as string) });
        uploadMap.set(id, { key, field: 'imageDesktop' });
      }

      const isMobileUploadable = mobileFile || typeof existingMobile === 'string';
      if (isMobileUploadable) {
        const id = `bento-${key}-mobile-${Date.now()}`;
        rawImagesToUpload.push({ id, source: mobileFile || (existingMobile as string) });
        uploadMap.set(id, { key, field: 'imageMobile' });
      }
    }

    let uploadedImages: IHeroImage[] = [];
    if (rawImagesToUpload.length > 0) {
      uploadedImages = await ImageService.UploadImages(rawImagesToUpload, `${tenantSlug}/bento-images`);
    }

    // Asignación de imágenes subidas o mantenimiento de las existentes
    let imageIndex = 0;
    for (const rawImg of rawImagesToUpload) {
      const mapping = uploadMap.get(rawImg.id);
      if (mapping) {
        const targetBlock = blocksParsed[mapping.key];
        
        if (targetBlock) {
          if (mapping.field === 'imageDesktop') {
            targetBlock.imageDesktop = uploadedImages[imageIndex];
          } else if (mapping.field === 'imageMobile') {
            targetBlock.imageMobile = uploadedImages[imageIndex];
          }
        }
        
        // Eliminar imagen anterior si se actualizó
        const curBlock = currentConfig?.blocks[mapping.key];
        const oldImage = curBlock?.[mapping.field];
        if (oldImage && typeof oldImage === 'object' && 'public_id' in oldImage && oldImage.public_id) {
           await ImageService.DeleteImage(oldImage.public_id).catch(err => console.error("Failed to delete old image:", err));
        }

        imageIndex++;
      }
    }

    const configPayload = {
      sectionTitle: data.sectionTitle || currentConfig?.sectionTitle || '',
      sectionSubtitle: data.sectionSubtitle || currentConfig?.sectionSubtitle || '',
      blocks: blocksParsed
    };

    if (currentConfig) {
      const updatedConfig = await models.BentoConfig.findByIdAndUpdate(currentConfig._id, configPayload, { new: true, runValidators: true }).lean();
      return updatedConfig;
    } else {
      const newConfig = await models.BentoConfig.create(configPayload);
      return newConfig;
    }
  }
}
