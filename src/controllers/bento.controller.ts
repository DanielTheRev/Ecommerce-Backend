import { NextFunction, Response } from 'express';
import { BentoService } from '@/services/bento.service';
import { AuthRequest } from '@/middleware/auth';
import { IBentoConfigCreateDTO } from '@/interfaces/bento.interface';

export class BentoController {
  static async getBentoConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const config = await BentoService.getBentoConfig(req.models!);
      return res.status(200).json(config);
    } catch (error) {
      return next(error);
    }
  }

  static async upsertBentoConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as IBentoConfigCreateDTO;
      console.log(data);
      const imageFiles = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      
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
