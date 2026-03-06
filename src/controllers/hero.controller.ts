import { NextFunction, Response } from 'express';
import { HeroService } from '../services/hero.service';
import { AuthRequest } from '@/middleware/auth';

export class HeroController {
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const slide = await HeroService.create(req.models!, data);
      return res.status(201).json(slide);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const slide = await HeroService.getById(req.models!, id);
      return res.json(slide);
    } catch (error) {
      return next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const slides = await HeroService.getAll(req.models!);
      return res.json(slides);
    } catch (error) {
      return next(error);
    }
  }

  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;
      const slide = await HeroService.update(req.models!, id, data);
      return res.json(slide);
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await HeroService.delete(req.models!, id);
      return res.json({ message: 'Slide deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }
}
