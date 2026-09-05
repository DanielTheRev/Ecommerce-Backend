import { Response, NextFunction } from 'express';
import { TenantRequest } from '@/middleware/tenant';
import { VisualMenuService } from '@/services/visualMenu.service';
import { AppError } from '@/errors/app.error';

export class VisualMenuController {
  /**
   * Obtiene la configuración del Menú Visual (Público y Panel)
   */
  static async getVisualMenu(req: TenantRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.models || !req.tenant) {
        throw new AppError('Tenant not resolved', 'Error al resolver la tienda', 500);
      }

      const config = await VisualMenuService.getVisualMenu(req.models, req.tenant.slug);
      res.status(200).json(config);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Crea o actualiza la configuración del Menú Visual (Admin)
   */
  static async updateVisualMenu(req: TenantRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.models || !req.tenant) {
        throw new AppError('Tenant not resolved', 'Error al resolver la tienda', 500);
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const data = {
        ...req.body,
        imageFiles: files
      };

      const updated = await VisualMenuService.upsertVisualMenu(req.models, req.tenant.slug, data);
      res.status(200).json({
        success: true,
        message: 'Menú visual actualizado correctamente',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }
}
