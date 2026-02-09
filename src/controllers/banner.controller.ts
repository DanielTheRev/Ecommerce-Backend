import { Request, Response, NextFunction } from 'express';
import { BannerService } from '@/services/banner.service';

export class BannerController {
  static async createBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const banner = await BannerService.createBanner(req.body);
      return res.status(201).json(banner);
    } catch (error) {
      return next(error);
    }
  }

  static async getAllBanners(req: Request, res: Response, next: NextFunction) {
    try {
      // If ?active=true is passed, return only active ones
      if (req.query.active === 'true') {
        const banners = await BannerService.getActiveBanners();
        return res.status(200).json(banners);
      }

      const banners = await BannerService.getAllBanners();
      return res.status(200).json(banners);
    } catch (error) {
      return next(error);
    }
  }

  static async getBannerById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const banner = await BannerService.getBannerById(id);
      return res.status(200).json(banner);
    } catch (error) {
      return next(error);
    }
  }

  static async updateBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const banner = await BannerService.updateBanner(id, req.body);
      res.status(200).json(banner);
    } catch (error) {
      next(error);
    }
  }

  static async deleteBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await BannerService.deleteBanner(id);
      res.status(200).json({
        success: true,
        message: 'Banner deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
