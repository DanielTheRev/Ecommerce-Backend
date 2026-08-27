import { NextFunction, Response } from 'express';
import { BentoService } from '@/services/bento.service';
import { AuthRequest } from '@/middleware/auth';
import { IBentoConfigCreateDTO } from '@/interfaces/bento.interface';

export class BentoController {
  static async getBentoConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const config = await BentoService.getBentoConfig(req.models!, req.tenant?.slug);
      return res.status(200).json(config);
    } catch (error) {
      return next(error);
    }
  }

  static async upsertBentoConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as IBentoConfigCreateDTO;
      
      const imageFiles: { [fieldname: string]: Express.Multer.File[] } = {};
      if (Array.isArray(req.files)) {
        req.files.forEach((file: Express.Multer.File) => {
          if (!imageFiles[file.fieldname]) {
            imageFiles[file.fieldname] = [];
          }
          imageFiles[file.fieldname].push(file);
        });
      } else if (req.files && typeof req.files === 'object') {
        Object.assign(imageFiles, req.files);
      }

      const config = await BentoService.upsertBentoConfig(
        req.models!, 
        req.tenant?.slug as string, 
        { ...data, imageFiles }
      );
      
      return res.status(200).json(config);
    } catch (error) {
      return next(error);
    }
  }
}
