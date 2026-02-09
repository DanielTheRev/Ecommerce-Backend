import { AppError } from '@/errors/app.error';
import { HeroSlide } from '../models/HeroSlide.model';
import { IHeroSlide } from '@/interfaces/home.interface';

export class HeroService {
  static async create(data: Partial<IHeroSlide>) {
    return await HeroSlide.create(data);
  }

  static async getById(id: string): Promise<IHeroSlide> {
    try {
      if (!id) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      const banner = await HeroSlide.findById(id).lean() as IHeroSlide;
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      throw new AppError('Error while getting banner', 'Error al obtener banner', 500);
    }
  }

  static async getAll() {
    try {
      const slides = await HeroSlide.find().sort({ order: 1 });
      if (!slides) throw new AppError('Banners not found', 'Banners no encontrados', 404);
      return slides;
    } catch (error) {
      throw new AppError('Error while getting banners', 'Error al obtener banners', 500);
    }
  }

  static async getActiveSlides() {
    try {
      const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1 });
      return slides;
    } catch (error) {
      throw new AppError('Error while getting banners', 'Error al obtener banners', 500);
    }
  }

  static async update(id: string, data: Partial<IHeroSlide>) {
    try {
      if (!id || !data) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      const fieldsToSelect = Object.keys(data).join(' ');
      const banner = await HeroSlide.findByIdAndUpdate(id, data, { new: true, runValidators: true, select: fieldsToSelect }).lean() as IHeroSlide;
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      throw error;
    }
  }

  static async delete(id: string) {
    try {
      const banner = await HeroSlide.findByIdAndDelete(id);
      if (!banner) throw new AppError('Banner not found', 'Banner no encontrado', 404);
      return banner;
    } catch (error) {
      throw new AppError('Error while deleting banner', 'Error al eliminar banner', 500);
    }
  }
}
