import { IHeroSlide } from '@/interfaces/hero.interface';
import { Schema, model } from 'mongoose';


const HeroSlideSchema = new Schema<IHeroSlide>(
  {
    title: { type: String, required: false, default: '' },
    slideType: { type: String, enum: ['visual', 'editorial', 'split'], default: 'visual' },
    sub_title: { type: String, required: false, default: '' },
    description: { type: String, required: false, default: '' },
    ctaText: { type: String, required: false, default: '' },
    ctaLink: { type: String, required: false, default: '' },
    imageDesktop1: {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    },
    imageDesktop2: {
      url: { type: String, required: false },
      public_id: { type: String, required: false }
    },
    imageMobile1: {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    },
    imageMobile2: {
      url: { type: String, required: false },
      public_id: { type: String, required: false }
    },
    featuredProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      }
    ],
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: false,
    versionKey: false
  }
);

// Schema exportado para multi-tenancy (model registry)
export { HeroSlideSchema };

export const HeroSlide = model<IHeroSlide>('HeroSlide', HeroSlideSchema);
