import { NextFunction, Response } from 'express';
import { BannerService } from '@/services/banner.service';
import { AuthRequest } from '@/middleware/auth';

export class BannerController {
  static async createBanner(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let data = req.body;
      const imageFile = req.file;
      const banner = await BannerService.createBanner(req.models!, { ...data, imageFile }, req.tenant?.slug);
      return res.status(201).json(banner);
    } catch (error) {
      return next(error);
    }
  }

  static async getAllBanners(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.query.active === 'true') {
        const banners = await BannerService.getActiveBanners(req.models!);
        return res.status(200).json(banners);
      }

      const banners = await BannerService.getAllBanners(req.models!);
      return res.status(200).json(banners);
    } catch (error) {
      return next(error);
    }
  }

  static async getBannerById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const banner = await BannerService.getBannerById(req.models!, id);
      return res.status(200).json(banner);
    } catch (error) {
      return next(error);
    }
  }

  static async updateBanner(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      let data = req.body;
      const imageFile = req.file;
      const banner = await BannerService.updateBanner(req.models!, id, { ...data, imageFile }, req.tenant?.slug);
      res.status(200).json(banner);
    } catch (error) {
      next(error);
    }
  }

  static async deleteBanner(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await BannerService.deleteBanner(req.models!, id);
      res.status(200).json({
        success: true,
        message: 'Banner deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
