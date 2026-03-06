export interface IHeroSlide extends Document {
  title: string;
  imageDesktop: string;
  imageMobile: string;
  link: string;
  altText: string;
  buttonText: string;
  buttonStyle: string;
  order: number;
  isActive: boolean;
}
import { Schema, model } from 'mongoose';


const HeroSlideSchema = new Schema<IHeroSlide>(
  {
    title: { type: String, required: true }, // Internal name for admin
    imageDesktop: { type: String, required: true },
    imageMobile: { type: String, required: true }, // Can fallback to desktop if same
    link: { type: String, default: '/' },
    altText: { type: String, default: 'Oferta' }, // SEO
    buttonText: { type: String, default: 'Ver Oferta' }, // New
    buttonStyle: { type: String, default: 'btn-primary' }, // New
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Schema exportado para multi-tenancy (model registry)
export { HeroSlideSchema };

export const HeroSlide = model<IHeroSlide>('HeroSlide', HeroSlideSchema);
