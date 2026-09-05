import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IVisualMenuConfig, IVisualMenuCreateDTO, IVisualMenuItem } from '@/interfaces/visualMenu.interface';
import { IHeroImage } from '@/interfaces/hero.interface';
import { ImageService } from './images.service';

export class VisualMenuService {
  /**
   * Obtiene la configuración del Menú Visual / Grilla
   */
  static async getVisualMenu(models: TenantModels, tenantSlug?: string): Promise<IVisualMenuConfig | null> {
    try {
      const cacheKey = 'visual-menu:config';
      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        const cached = CacheService.get<IVisualMenuConfig>(tenantSlug, cacheKey);
        if (cached) return cached;
      }

      let config = await models.VisualMenu.findOne().lean() as unknown as IVisualMenuConfig | null;

      // Si no existe en VisualMenu, verificar si hay un BentoConfig previo para migrarlo
      if (!config) {
        const legacyBento = await models.BentoConfig.findOne().lean() as any;
        if (legacyBento && (legacyBento.items?.length > 0 || legacyBento.blocks)) {
          const legacyItems = legacyBento.items || [];
          const migratedItems: IVisualMenuItem[] = legacyItems.map((item: any, idx: number) => ({
            title: item.title || `Item ${idx + 1}`,
            subtitle: item.subtitle || '',
            badge: '',
            link: item.link || '/products',
            imageDesktop: item.imageDesktop || { url: '/productsMock/bento-1.jpeg', public_id: 'default' },
            imageMobile: item.imageMobile,
            colSpanDesktop: item.gridSpan === 'main' || item.gridSpan === 'full-width' ? 12 : 6,
            colSpanTablet: 3,
            colSpanMobile: 2,
            rowSpanDesktop: item.gridSpan === 'main' ? 2 : 1,
            order: item.order || idx + 1,
            isActive: item.isActive !== false,
            children: []
          }));

          config = await models.VisualMenu.create({
            sectionTitle: legacyBento.sectionTitle || 'Vura / Catálogo',
            sectionSubtitle: legacyBento.sectionSubtitle || 'Explorá Nuestras Categorías.',
            displayMode: 'grid',
            items: migratedItems,
            isActive: true
          }) as unknown as IVisualMenuConfig;
        }
      }

      // Si aún no existe, crear default items
      if (!config) {
        const defaultItems: IVisualMenuItem[] = [
          {
            title: 'Hombre',
            subtitle: 'Colección 2026',
            badge: 'NUEVO',
            link: '/products?gender=Hombre',
            colSpanDesktop: 6,
            colSpanTablet: 3,
            colSpanMobile: 2,
            rowSpanDesktop: 1,
            order: 1,
            isActive: true,
            imageDesktop: { url: '/productsMock/bento-1.jpeg', public_id: 'default-1' },
            children: [
              { label: 'Remeras', link: '/products?gender=Hombre&category=remeras' },
              { label: 'Pantalones', link: '/products?gender=Hombre&category=pantalones' },
              { label: 'Abrigos', link: '/products?gender=Hombre&category=abrigos' }
            ]
          },
          {
            title: 'Mujer',
            subtitle: 'Tendencia Primavera',
            badge: 'TREND',
            link: '/products?gender=Mujer',
            colSpanDesktop: 6,
            colSpanTablet: 3,
            colSpanMobile: 2,
            rowSpanDesktop: 1,
            order: 2,
            isActive: true,
            imageDesktop: { url: '/productsMock/campera.webp', public_id: 'default-2' },
            children: [
              { label: 'Vestidos', link: '/products?gender=Mujer&category=vestidos' },
              { label: 'Tops', link: '/products?gender=Mujer&category=tops' },
              { label: 'Camisas', link: '/products?gender=Mujer&category=camisas' }
            ]
          },
          {
            title: 'Calzados & Accesorios',
            subtitle: 'Esenciales',
            link: '/products?category=calzado',
            colSpanDesktop: 4,
            colSpanTablet: 3,
            colSpanMobile: 1,
            rowSpanDesktop: 1,
            order: 3,
            isActive: true,
            imageDesktop: { url: '/productsMock/hero image 2.png', public_id: 'default-3' },
            children: [
              { label: 'Zapatillas', link: '/products?category=calzado&type=zapatillas' },
              { label: 'Bolsos', link: '/products?category=accesorios&type=bolsos' }
            ]
          },
          {
            title: 'Archive Sale',
            subtitle: 'Hasta 40% OFF',
            badge: 'HOT SALE',
            link: '/products?tags=archive-sale',
            colSpanDesktop: 8,
            colSpanTablet: 3,
            colSpanMobile: 1,
            rowSpanDesktop: 1,
            order: 4,
            isActive: true,
            imageDesktop: { url: '/productsMock/remera wanama manga larga.webp', public_id: 'default-4' },
            children: []
          }
        ];

        config = await models.VisualMenu.create({
          sectionTitle: 'Vura / Catálogo',
          sectionSubtitle: 'Explorá la Colección.',
          displayMode: 'grid',
          items: defaultItems,
          isActive: true
        }) as unknown as IVisualMenuConfig;
      }

      if (tenantSlug && config) {
        const { CacheService } = await import('./cache.service');
        CacheService.set(tenantSlug, cacheKey, config, 10 * 60 * 1000);
      }

      return config;
    } catch (error) {
      throw new AppError('Error while getting Visual Menu config', 'Error al obtener la configuración del Menú Visual', 500);
    }
  }

  /**
   * Crea o actualiza la configuración del Menú Visual
   */
  static async upsertVisualMenu(models: TenantModels, tenantSlug: string, data: IVisualMenuCreateDTO) {
    if (!tenantSlug) throw new AppError('No tenant slug provided for VisualMenuService.upsertVisualMenu', 'Error interno del servidor.', 500);

    const currentConfig = await models.VisualMenu.findOne().lean() as unknown as IVisualMenuConfig | null;

    let itemsParsed: any[] = [];
    if (data.items) {
      try {
        itemsParsed = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
      } catch (error) {
        throw new AppError('Invalid items format', 'Formato de items del Menú Visual inválido', 400);
      }
    }

    const rawImagesToUpload: { id: string; source: string | Express.Multer.File }[] = [];
    const uploadMap = new Map<string, { itemIndex: number; field: 'imageDesktop' | 'imageMobile' }>();

    itemsParsed.forEach((item: any, index: number) => {
      const desktopFile = data.imageFiles?.[`item_${index}_imageDesktop`]?.[0] || data.imageFiles?.[`item_${index}_image`]?.[0];
      const mobileFile = data.imageFiles?.[`item_${index}_imageMobile`]?.[0];

      const existingDesktop = item.imageDesktop;
      const existingMobile = item.imageMobile;

      if (desktopFile || typeof existingDesktop === 'string') {
        const id = `visualmenu-item-${index}-desktop-${Date.now()}`;
        rawImagesToUpload.push({ id, source: desktopFile || (existingDesktop as string) });
        uploadMap.set(id, { itemIndex: index, field: 'imageDesktop' });
      }

      if (mobileFile || typeof existingMobile === 'string') {
        const id = `visualmenu-item-${index}-mobile-${Date.now()}`;
        rawImagesToUpload.push({ id, source: mobileFile || (existingMobile as string) });
        uploadMap.set(id, { itemIndex: index, field: 'imageMobile' });
      }
    });

    let uploadedImages: IHeroImage[] = [];
    if (rawImagesToUpload.length > 0) {
      uploadedImages = await ImageService.UploadImages(rawImagesToUpload, `${tenantSlug}/visual-menu`);
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

    // Sanitizar y validar items finales
    const finalItems: IVisualMenuItem[] = itemsParsed.map((item: any, idx: number) => {
      const currentItem = currentConfig?.items?.find((i: any) => i._id?.toString() === item._id?.toString());
      return {
        _id: item._id,
        title: item.title || `Item ${idx + 1}`,
        subtitle: item.subtitle || '',
        badge: item.badge || '',
        link: item.link || '/products',
        imageDesktop: (typeof item.imageDesktop === 'object' && item.imageDesktop?.url)
          ? item.imageDesktop
          : currentItem?.imageDesktop || { url: '/productsMock/bento-1.jpeg', public_id: 'default' },
        imageMobile: (typeof item.imageMobile === 'object' && item.imageMobile?.url)
          ? item.imageMobile
          : currentItem?.imageMobile,
        colSpanDesktop: Number(item.colSpanDesktop) || 6,
        colSpanTablet: Number(item.colSpanTablet) || 3,
        colSpanMobile: Number(item.colSpanMobile) || 2,
        rowSpanDesktop: Number(item.rowSpanDesktop) || 1,
        order: Number(item.order) ?? idx + 1,
        isActive: item.isActive !== false,
        children: Array.isArray(item.children) ? item.children.map((c: any, cIdx: number) => ({
          _id: c._id,
          label: c.label || '',
          link: c.link || '/products',
          badge: c.badge || '',
          order: Number(c.order) ?? cIdx + 1
        })) : []
      };
    });

    const updatePayload: any = {
      sectionTitle: data.sectionTitle ?? currentConfig?.sectionTitle ?? 'Vura / Catálogo',
      sectionSubtitle: data.sectionSubtitle ?? currentConfig?.sectionSubtitle ?? 'Explorá Nuestras Categorías.',
      description: data.description ?? currentConfig?.description ?? '',
      displayMode: data.displayMode ?? currentConfig?.displayMode ?? 'grid',
      isActive: data.isActive !== undefined ? (data.isActive === 'true' || data.isActive === true) : (currentConfig?.isActive !== false),
      items: finalItems
    };

    let updatedConfig;
    if (currentConfig) {
      updatedConfig = await models.VisualMenu.findOneAndUpdate(
        {},
        { $set: updatePayload },
        { new: true, runValidators: true }
      ).lean();
    } else {
      updatedConfig = await models.VisualMenu.create(updatePayload);
    }

    // Invalidar cachés
    const { CacheService } = await import('./cache.service');
    CacheService.invalidate(tenantSlug, 'visual-menu:config');
    CacheService.invalidate(tenantSlug, 'bento:config');

    return updatedConfig;
  }
}
