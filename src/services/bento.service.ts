import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IBentoConfig, IBentoConfigCreateDTO, IBentoItem } from '@/interfaces/bento.interface';
import { IHeroImage } from '@/interfaces/hero.interface';
import { ImageService } from './images.service';

export class BentoService {
  /**
   * Obtiene la configuración de Bento
   */
  static async getBentoConfig(models: TenantModels, tenantSlug?: string): Promise<IBentoConfig | null> {
    try {
      const cacheKey = 'bento:config';
      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        const cached = CacheService.get<IBentoConfig>(tenantSlug, cacheKey);
        if (cached) return cached;
      }

      let config = await models.BentoConfig.findOne().lean() as unknown as IBentoConfig | null;

      if (!config) {
        const defaultItems: IBentoItem[] = [
          { title: 'Hombre', subtitle: 'Colección 2026', link: '/products?gender=Hombre', gridSpan: 'main', order: 1, isActive: true, imageDesktop: { url: '/productsMock/bento-1.jpeg', public_id: 'default-1' } },
          { title: 'Mujer', subtitle: 'Tendencia', link: '/products?gender=Mujer', gridSpan: 'top-right', order: 2, isActive: true, imageDesktop: { url: '/productsMock/campera.webp', public_id: 'default-2' } },
          { title: 'Poleras & Abrigos', subtitle: 'Esenciales', link: '/products?category=Poleras', gridSpan: 'bottom-right', order: 3, isActive: true, imageDesktop: { url: '/productsMock/hero image 2.png', public_id: 'default-3' } },
          { title: 'Archive Sale.', subtitle: 'Hasta 40% OFF', link: '/products?tags=archive-sale', gridSpan: 'full-width', order: 4, isActive: true, imageDesktop: { url: '/productsMock/remera wanama manga larga.webp', public_id: 'default-4' } }
        ];

        config = await models.BentoConfig.create({
          sectionTitle: 'Vura / Catálogo',
          sectionSubtitle: 'Explorá la Colección.',
          items: defaultItems
        }) as unknown as IBentoConfig;
      }

      // Si no tiene items pero sí blocks legacy, convertir a items para el frontend dinámico
      if ((!config.items || config.items.length === 0) && config.blocks) {
        const items: IBentoItem[] = [];
        if (config.blocks.mainBlock) {
          items.push({ ...config.blocks.mainBlock, gridSpan: 'main', order: 1 });
        }
        if (config.blocks.topRightBlock) {
          items.push({ ...config.blocks.topRightBlock, gridSpan: 'top-right', order: 2 });
        }
        if (config.blocks.bottomRightBlock) {
          items.push({ ...config.blocks.bottomRightBlock, gridSpan: 'bottom-right', order: 3 });
        }
        if (config.blocks.footerBlock) {
          items.push({ ...config.blocks.footerBlock, gridSpan: 'full-width', order: 4 });
        }
        config.items = items;
      }

      if (tenantSlug && config) {
        const { CacheService } = await import('./cache.service');
        CacheService.set(tenantSlug, cacheKey, config, 10 * 60 * 1000);
      }

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

    const currentConfig = await models.BentoConfig.findOne().lean() as unknown as IBentoConfig | null;

    // Caso 1: Se envían items dinámicos (Nuevo Panel de Control)
    if (data.items) {
      let itemsParsed: any[];
      try {
        itemsParsed = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
      } catch (error) {
        throw new AppError('Invalid items format', 'Formato de items de Bento inválido', 400);
      }

      const rawImagesToUpload: { id: string; source: string | Express.Multer.File }[] = [];
      const uploadMap = new Map<string, { itemIndex: number; field: 'imageDesktop' | 'imageMobile' }>();

      itemsParsed.forEach((item: any, index: number) => {
        const desktopFile = data.imageFiles?.[`item_${index}_imageDesktop`]?.[0] || data.imageFiles?.[`item_${index}_image`]?.[0];
        const mobileFile = data.imageFiles?.[`item_${index}_imageMobile`]?.[0];

        const existingDesktop = item.imageDesktop;
        const existingMobile = item.imageMobile;

        if (desktopFile || typeof existingDesktop === 'string') {
          const id = `bento-item-${index}-desktop-${Date.now()}`;
          rawImagesToUpload.push({ id, source: desktopFile || (existingDesktop as string) });
          uploadMap.set(id, { itemIndex: index, field: 'imageDesktop' });
        }

        if (mobileFile || typeof existingMobile === 'string') {
          const id = `bento-item-${index}-mobile-${Date.now()}`;
          rawImagesToUpload.push({ id, source: mobileFile || (existingMobile as string) });
          uploadMap.set(id, { itemIndex: index, field: 'imageMobile' });
        }
      });

      let uploadedImages: IHeroImage[] = [];
      if (rawImagesToUpload.length > 0) {
        uploadedImages = await ImageService.UploadImages(rawImagesToUpload, `${tenantSlug}/bento-images`);
      }

      let imageIndex = 0;
      for (const rawImg of rawImagesToUpload) {
        const mapping = uploadMap.get(rawImg.id);
        if (mapping) {
          const targetItem = itemsParsed[mapping.itemIndex];
          if (targetItem) {
            targetItem[mapping.field] = uploadedImages[imageIndex];
          }
          imageIndex++;
        }
      }

      const normalizedItems = itemsParsed.map((item: any) => ({
        ...item,
        imageDesktop: typeof item.imageDesktop === 'string'
          ? { url: item.imageDesktop, public_id: '' }
          : item.imageDesktop
            ? { url: item.imageDesktop.url || '', public_id: item.imageDesktop.public_id || '' }
            : { url: '', public_id: '' },
        imageMobile: typeof item.imageMobile === 'string'
          ? { url: item.imageMobile, public_id: '' }
          : (item.imageMobile && item.imageMobile.url)
            ? { url: item.imageMobile.url || '', public_id: item.imageMobile.public_id || '' }
            : undefined
      }));

      const configPayload = {
        sectionTitle: data.sectionTitle || currentConfig?.sectionTitle || 'Vura / Catálogo',
        sectionSubtitle: data.sectionSubtitle || currentConfig?.sectionSubtitle || 'Explorá la Colección.',
        items: normalizedItems
      };

      if (currentConfig) {
        const updatedConfig = await models.BentoConfig.findByIdAndUpdate(currentConfig._id, configPayload, { new: true, runValidators: true }).lean();
        return updatedConfig;
      } else {
        const newConfig = await models.BentoConfig.create(configPayload);
        return newConfig;
      }
    }

    // Caso 2: Se envían blocks legacy (Compatibilidad anterior)
    if (!data.blocks) throw new AppError('No blocks or items provided', 'Los bloques del Bento son obligatorios.', 400);

    let blocksParsed: any;
    try {
      blocksParsed = typeof data.blocks === 'string' ? JSON.parse(data.blocks) : data.blocks;
    } catch (error) {
      throw new AppError('Invalid blocks format', 'Formato de bloques inválido', 400);
    }

    const blockKeys = ['mainBlock', 'topRightBlock', 'bottomRightBlock', 'footerBlock'] as const;
    const rawImagesToUpload: { id: string; source: string | Express.Multer.File }[] = [];
    const uploadMap = new Map<string, { key: "mainBlock" | "topRightBlock" | "bottomRightBlock" | "footerBlock"; field: 'imageDesktop' | 'imageMobile' }>();
    
    for (const key of blockKeys) {
      if (!blocksParsed[key]) continue;

      const desktopFile = data.imageFiles?.[`${key}_imageDesktop`]?.[0];
      const mobileFile = data.imageFiles?.[`${key}_imageMobile`]?.[0];

      const existingDesktop = blocksParsed[key]?.imageDesktop;
      const existingMobile = blocksParsed[key]?.imageMobile;

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

    let imageIndex = 0;
    for (const rawImg of rawImagesToUpload) {
      const mapping = uploadMap.get(rawImg.id);
      if (mapping) {
        const targetBlock = blocksParsed[mapping.key];
        if (targetBlock) {
          targetBlock[mapping.field] = uploadedImages[imageIndex];
        }
        imageIndex++;
      }
    }

    // Convertir a items
    const itemsFromBlocks: IBentoItem[] = [];
    if (blocksParsed.mainBlock) itemsFromBlocks.push({ ...blocksParsed.mainBlock, gridSpan: 'main', order: 1 });
    if (blocksParsed.topRightBlock) itemsFromBlocks.push({ ...blocksParsed.topRightBlock, gridSpan: 'top-right', order: 2 });
    if (blocksParsed.bottomRightBlock) itemsFromBlocks.push({ ...blocksParsed.bottomRightBlock, gridSpan: 'bottom-right', order: 3 });
    if (blocksParsed.footerBlock) itemsFromBlocks.push({ ...blocksParsed.footerBlock, gridSpan: 'full-width', order: 4 });

    const configPayload = {
      sectionTitle: data.sectionTitle || currentConfig?.sectionTitle || '',
      sectionSubtitle: data.sectionSubtitle || currentConfig?.sectionSubtitle || '',
      blocks: blocksParsed,
      items: itemsFromBlocks
    };

    let result: any;
    if (currentConfig) {
      result = await models.BentoConfig.findByIdAndUpdate(currentConfig._id, configPayload, { new: true, runValidators: true }).lean();
    } else {
      result = await models.BentoConfig.create(configPayload);
    }

    if (tenantSlug) {
      const { CacheService } = await import('./cache.service');
      CacheService.invalidatePrefix(tenantSlug, 'bento');
      CacheService.invalidatePrefix(tenantSlug, 'home');
    }

    return result;
  }
}
