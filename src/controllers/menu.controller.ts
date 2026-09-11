import { Request, Response, NextFunction } from 'express';
import { MenuService } from '@/services/menu.service';

export class MenuController {
  /**
   * Obtiene todos los menús
   */
  static async getMenus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = (req as any).models;
      const tenantSlug = (req as any).tenant?.slug || req.body?.tenantSlug;
      const menus = await MenuService.getMenus(models, tenantSlug);

      res.status(200).json({
        success: true,
        data: menus
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtiene un menú por slug o ID
   */
  static async getMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = (req as any).models;
      const { slugOrId } = req.params;
      const tenantSlug = (req as any).tenant?.slug || req.body?.tenantSlug;
      const menu = await MenuService.getMenuBySlugOrId(models, slugOrId, tenantSlug);

      if (!menu) {
        res.status(404).json({
          success: false,
          message: `Menú "${slugOrId}" no encontrado.`
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: menu
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crea un nuevo menú
   */
  static async createMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = (req as any).models;
      const tenantSlug = (req as any).tenant?.slug || (req as any).tenantSlug || req.body?.tenantSlug;
      const files = req.files as Express.Multer.File[];

      let payload = req.body;
      if (typeof req.body.data === 'string') {
        try {
          payload = JSON.parse(req.body.data);
        } catch (e) {}
      }

      if (typeof payload.items === 'string') {
        try {
          payload.items = JSON.parse(payload.items);
        } catch (e) {}
      }

      const menu = await MenuService.createMenu(models, payload, files, tenantSlug);

      res.status(201).json({
        success: true,
        message: 'Menú creado exitosamente.',
        data: menu
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Actualiza un menú existente
   */
  static async updateMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = (req as any).models;
      const { id } = req.params;
      const tenantSlug = (req as any).tenant?.slug || (req as any).tenantSlug || req.body?.tenantSlug;
      const files = req.files as Express.Multer.File[];

      let payload = req.body;
      if (typeof req.body.data === 'string') {
        try {
          payload = JSON.parse(req.body.data);
        } catch (e) {}
      }

      if (typeof payload.items === 'string') {
        try {
          payload.items = JSON.parse(payload.items);
        } catch (e) {}
      }

      const menu = await MenuService.updateMenu(models, id, payload, files, tenantSlug);

      res.status(200).json({
        success: true,
        message: 'Menú actualizado exitosamente.',
        data: menu
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Elimina un menú
   */
  static async deleteMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = (req as any).models;
      const { id } = req.params;
      const tenantSlug = (req as any).tenant?.slug || (req as any).tenantSlug || req.body?.tenantSlug;

      await MenuService.deleteMenu(models, id, tenantSlug);

      res.status(200).json({
        success: true,
        message: 'Menú eliminado exitosamente.'
      });
    } catch (error) {
      next(error);
    }
  }
}
