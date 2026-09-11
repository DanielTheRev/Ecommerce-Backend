import { AppError } from '@/errors/app.error';
import { TenantModels } from '@/config/modelRegistry';
import { IMenu, IMenuCreateDTO, IMenuItem, IMenuItemChild } from '@/interfaces/menu.interface';
import { ImageService } from './images.service';
import { isValidObjectId } from 'mongoose';

export class MenuService {
  /**
   * Helper para generar slugs a partir de un string
   */
  static slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  /**
   * Default Categories Menu
   */
  static getDefaultCategoriesMenu(): IMenuCreateDTO {
    return {
      name: 'Categorías Principales',
      slug: 'categories',
      description: 'Menú principal de categorías con fotos y subcategorías para el Home y Navegación.',
      isActive: true,
      items: [
        {
          label: 'Hombre',
          subtitle: 'Colección 2026',
          badge: 'NUEVO',
          link: '/products?gender=Hombre',
          order: 1,
          isActive: true,
          image: { url: '/productsMock/bento-1.jpeg', public_id: 'default-hombre' },
          children: [
            { label: 'Remeras', link: '/products?gender=Hombre&category=remeras', order: 1, isActive: true },
            { label: 'Pantalones', link: '/products?gender=Hombre&category=pantalones', order: 2, isActive: true },
            { label: 'Buzos & Hoodies', link: '/products?gender=Hombre&category=buzos', order: 3, isActive: true },
          ]
        },
        {
          label: 'Mujer',
          subtitle: 'Tendencias & Esenciales',
          badge: 'DESTACADO',
          link: '/products?gender=Mujer',
          order: 2,
          isActive: true,
          image: { url: '/productsMock/campera.webp', public_id: 'default-mujer' },
          children: [
            { label: 'Tops & Remeras', link: '/products?gender=Mujer&category=remeras', order: 1, isActive: true },
            { label: 'Abrigos', link: '/products?gender=Mujer&category=abrigos', order: 2, isActive: true },
            { label: 'Pantalones', link: '/products?gender=Mujer&category=pantalones', order: 3, isActive: true },
          ]
        },
        {
          label: 'Poleras & Abrigos',
          subtitle: 'Temporada Invierno',
          link: '/products?category=Poleras',
          order: 3,
          isActive: true,
          image: { url: '/productsMock/hero image 2.png', public_id: 'default-poleras' },
          children: [
            { label: 'Poleras de Hilo', link: '/products?category=poleras', order: 1, isActive: true },
            { label: 'Camperas', link: '/products?category=camperas', order: 2, isActive: true },
          ]
        },
        {
          label: 'Archive Sale',
          subtitle: 'Hasta 40% OFF',
          badge: 'OFERTA',
          link: '/products?tags=archive-sale',
          order: 4,
          isActive: true,
          image: { url: '/productsMock/remera wanama manga larga.webp', public_id: 'default-sale' },
          children: [
            { label: 'Últimos Talles', link: '/products?tags=ultimos-talles', order: 1, isActive: true },
            { label: 'Liquidación', link: '/products?tags=sale', order: 2, isActive: true },
          ]
        },
        {
          label: 'Calzado & Accesorios',
          subtitle: 'Detalles que definen',
          link: '/products?category=Accesorios',
          order: 5,
          isActive: true,
          image: { url: '/productsMock/categories/vura-sneakers-category.png', public_id: 'default-sneakers' },
          children: [
            { label: 'Sneakers', link: '/products?category=sneakers', order: 1, isActive: true },
            { label: 'Gorras & Bags', link: '/products?category=accesorios', order: 2, isActive: true },
          ]
        }
      ]
    };
  }

  /**
   * Obtiene todos los menús del tenant
   */
  static async getMenus(models: TenantModels, tenantSlug?: string): Promise<IMenu[]> {
    try {
      const cacheKey = 'menus:list';
      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        const cached = CacheService.get<IMenu[]>(tenantSlug, cacheKey);
        if (cached) return cached;
      }

      let menus = (await models.Menu.find().sort({ createdAt: 1 }).lean()) as unknown as IMenu[];

      if (!menus || menus.length === 0) {
        const defaultCategories = this.getDefaultCategoriesMenu();
        const created = (await models.Menu.create(defaultCategories)) as unknown as IMenu;
        menus = [created];
      }

      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        CacheService.set(tenantSlug, cacheKey, menus, 10 * 60 * 1000);
      }

      return menus;
    } catch (error) {
      console.error('Error al obtener menús:', error);
      return [this.getDefaultCategoriesMenu() as IMenu];
    }
  }

  /**
   * Obtiene un menú por slug o ID
   */
  static async getMenuBySlugOrId(
    models: TenantModels,
    slugOrId: string,
    tenantSlug?: string
  ): Promise<IMenu | null> {
    try {
      const normalized = slugOrId.trim().toLowerCase();
      const cacheKey = `menus:${normalized}`;
      if (tenantSlug) {
        const { CacheService } = await import('./cache.service');
        const cached = CacheService.get<IMenu>(tenantSlug, cacheKey);
        if (cached) return cached;
      }

      let query: any = { slug: normalized };
      if (isValidObjectId(slugOrId)) {
        query = { $or: [{ slug: normalized }, { _id: slugOrId }] };
      }

      let menu = (await models.Menu.findOne(query).lean()) as unknown as IMenu | null;

      // Si no existe y es 'categories', crearlo por defecto
      if (!menu && (normalized === 'categories' || normalized === 'categorias')) {
        const defaultCategories = this.getDefaultCategoriesMenu();
        menu = (await models.Menu.create(defaultCategories)) as unknown as IMenu;
      }

      if (menu && tenantSlug) {
        const { CacheService } = await import('./cache.service');
        CacheService.set(tenantSlug, cacheKey, menu, 10 * 60 * 1000);
      }

      return menu;
    } catch (error) {
      console.error(`Error al obtener menú ${slugOrId}:`, error);
      if (slugOrId === 'categories' || slugOrId === 'categorias') {
        return this.getDefaultCategoriesMenu() as IMenu;
      }
      return null;
    }
  }

  /**
   * Crea un nuevo menú
   */
  static async createMenu(
    models: TenantModels,
    data: IMenuCreateDTO,
    files?: any[],
    tenantSlug?: string
  ): Promise<IMenu> {
    if (!data.name?.trim()) {
      throw new AppError('El nombre del menú es requerido.', 'El nombre del menú es requerido.', 400);
    }

    const slug = data.slug?.trim() ? this.slugify(data.slug) : this.slugify(data.name);
    const existing = await models.Menu.findOne({ slug }).lean();
    if (existing) {
      throw new AppError(`Ya existe un menú con el identificador "${slug}".`, `Ya existe un menú con el identificador "${slug}".`, 400);
    }

    // Procesar items y subidas de imágenes
    const items = await this.processItemsImages(data.items || [], files);

    const newMenu = await models.Menu.create({
      name: data.name.trim(),
      slug,
      description: data.description?.trim() || '',
      items,
      isActive: data.isActive !== false
    });

    const { CacheService } = await import('./cache.service');
    CacheService.invalidatePrefix(tenantSlug, 'menus');
    CacheService.invalidatePrefix(tenantSlug, 'home');
    CacheService.invalidatePrefix(tenantSlug, 'bento');
    CacheService.invalidatePrefix(tenantSlug, 'visual-menu');

    return newMenu.toObject() as unknown as IMenu;
  }

  /**
   * Actualiza un menú existente
   */
  static async updateMenu(
    models: TenantModels,
    menuId: string,
    data: Partial<IMenuCreateDTO>,
    files?: any[],
    tenantSlug?: string
  ): Promise<IMenu> {
    let menu: any = null;
    if (isValidObjectId(menuId)) {
      menu = await models.Menu.findById(menuId);
    }
    if (!menu) {
      menu = await models.Menu.findOne({ slug: menuId.trim().toLowerCase() });
    }
    if (!menu) {
      throw new AppError('Menú no encontrado.', 'Menú no encontrado.', 404);
    }

    if (data.name) menu.name = data.name.trim();
    if (data.slug) {
      const slug = this.slugify(data.slug);
      if (slug !== menu.slug) {
        const existing = await models.Menu.findOne({ slug, _id: { $ne: menu._id } }).lean();
        if (existing) {
          throw new AppError(`Ya existe otro menú con el identificador "${slug}".`, `Ya existe otro menú con el identificador "${slug}".`, 400);
        }
        menu.slug = slug;
      }
    }
    if (data.description !== undefined) menu.description = data.description.trim();
    if (data.isActive !== undefined) menu.isActive = data.isActive;

    if (data.items) {
      menu.items = (await this.processItemsImages(data.items, files, menu.items)) as any;
      menu.markModified('items');
    }

    await menu.save();

    const { CacheService } = await import('./cache.service');
    CacheService.invalidatePrefix(tenantSlug, 'menus');
    CacheService.invalidatePrefix(tenantSlug, 'home');
    CacheService.invalidatePrefix(tenantSlug, 'bento');
    CacheService.invalidatePrefix(tenantSlug, 'visual-menu');

    return menu.toObject() as unknown as IMenu;
  }

  /**
   * Elimina un menú
   */
  static async deleteMenu(
    models: TenantModels,
    menuId: string,
    tenantSlug?: string
  ): Promise<boolean> {
    let menu: any = null;
    if (isValidObjectId(menuId)) {
      menu = await models.Menu.findByIdAndDelete(menuId);
    }
    if (!menu) {
      menu = await models.Menu.findOneAndDelete({ slug: menuId.trim().toLowerCase() });
    }
    if (!menu) {
      throw new AppError('Menú no encontrado.', 'Menú no encontrado.', 404);
    }

    const { CacheService } = await import('./cache.service');
    CacheService.invalidatePrefix(tenantSlug, 'menus');
    CacheService.invalidatePrefix(tenantSlug, 'home');
    CacheService.invalidatePrefix(tenantSlug, 'bento');
    CacheService.invalidatePrefix(tenantSlug, 'visual-menu');

    return true;
  }

  /**
   * Procesa imágenes de ítems y las sube a Cloudinary si vienen archivos en multer
   */
  private static async processItemsImages(
    newItems: IMenuItem[],
    files?: any[],
    currentItems?: any[]
  ): Promise<IMenuItem[]> {
    const processed: IMenuItem[] = [];

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      const currentItem = currentItems?.find(
        (c: any) => c._id?.toString() === (item._id ? item._id.toString() : '')
      );

      // Buscar si vino archivo para este item: image_0, image_item_0, etc.
      const itemImageFile = files?.find(
        (f) =>
          f.fieldname === `image_${i}` ||
          f.fieldname === `image_item_${i}` ||
          f.fieldname === `items[${i}][image]`
      );

      let image = item.image;

      if (itemImageFile) {
        const uploaded = await ImageService.UploadImages([{ id: `menu-item-${i}`, source: itemImageFile }], 'menus');
        if (uploaded && uploaded.length > 0) {
          image = {
            url: uploaded[0].url,
            public_id: uploaded[0].public_id,
            width: uploaded[0].width,
            height: uploaded[0].height
          };
        }
      } else if (item.image?.public_id === 'existing' && currentItem?.image?.public_id) {
        image = {
          ...item.image,
          public_id: currentItem.image.public_id
        };
      } else if (item.image === undefined && currentItem?.image) {
        image = currentItem.image;
      } else if (!item.image || !item.image.url) {
        image = undefined;
      }

      // Procesar subítems / children
      const children: IMenuItemChild[] = (item.children || []).map((child, childIdx) => ({
        ...(child._id && isValidObjectId(child._id) ? { _id: child._id } : {}),
        label: child.label?.trim() || `Subítem ${childIdx + 1}`,
        link: child.link?.trim() || '/products',
        badge: child.badge?.trim() || '',
        image: child.image,
        order: child.order ?? childIdx + 1,
        isActive: child.isActive !== false
      }));

      processed.push({
        ...(item._id && isValidObjectId(item._id) ? { _id: item._id } : {}),
        label: item.label?.trim() || `Ítem ${i + 1}`,
        link: item.link?.trim() || '/products',
        badge: item.badge?.trim() || '',
        subtitle: item.subtitle?.trim() || '',
        image,
        order: item.order ?? i + 1,
        isActive: item.isActive !== false,
        target: item.target || '_self',
        children
      });
    }

    return processed;
  }
}
