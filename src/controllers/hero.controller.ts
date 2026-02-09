import { Request, Response, NextFunction } from 'express';
import { HeroService } from '../services/hero.service';

export class HeroController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const slide = await HeroService.create(data);
      return res.status(201).json(slide);
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const slide = await HeroService.getById(id);
      return res.json(slide);
    } catch (error) {
      return next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const slides = await HeroService.getAll();
      return res.json(slides);
    } catch (error) {
      return next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;
      const slide = await HeroService.update(id, data);
      return res.json(slide);
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await HeroService.delete(id);
      return res.json({ message: 'Slide deleted successfully' });
    } catch (error) {
      return next(error);
    }
  }
}
