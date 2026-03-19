import { IHeroSlide } from '@/interfaces/hero.interface';
import { Schema, model } from 'mongoose';


const HeroSlideSchema = new Schema<IHeroSlide>(
  {
    title: { type: String, required: true }, // "Vura Essentials" (String)
    sub_title: { type: String, required: true }, // "FW / 2026" (String)
    description: { type: String, required: true }, // "Prendas diseñadas para perdurar..." (String)
    ctaText: { type: String, required: true }, // "Comprar Colección" (String)
    ctaLink: { type: String, required: true }, // /products?collection=autumn-2026 o /collections/essentials (String)
    imageDesktop: {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    },
    imageMobile: {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    },
    featuredProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      }
    ],//Un array de IDs de productos. (Esto es para el "Shop the Look").
    isActive: { type: Boolean, default: false }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

// Schema exportado para multi-tenancy (model registry)
export { HeroSlideSchema };

export const HeroSlide = model<IHeroSlide>('HeroSlide', HeroSlideSchema);
