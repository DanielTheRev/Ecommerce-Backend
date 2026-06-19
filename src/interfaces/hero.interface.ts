import { ObjectId } from "mongoose";
import { IProduct } from "./product.interface";

export interface IHeroSlideDocument extends Document {
  title: string;
  imageDesktop1: string;
  imageDesktop2?: string;
  imageMobile1: string;
  imageMobile2?: string;
  sub_title: string, // "FW / 2026" (String)
  description: string, // "Prendas diseñadas para perdurar..." (String)
  ctaText: string, // "Comprar Colección" (String)
  ctaLink: string, // /products?collection=autumn-2026 o /collections/essentials (String)
  order: number;
  isActive: boolean;
  featuredProducts: IProduct[]
}

export interface IHeroSlide {
  _id: ObjectId;
  title: string;
  imageDesktop1: IHeroImage;
  imageDesktop2?: IHeroImage;
  imageMobile1: IHeroImage;
  imageMobile2?: IHeroImage;
  sub_title: string, // "FW / 2026" (String)
  description: string, // "Prendas diseñadas para perdurar..." (String)
  ctaText: string, // "Comprar Colección" (String)
  ctaLink: string, // /products?collection=autumn-2026 o /collections/essentials (String)
  order: number;
  isActive: boolean;
  featuredProducts: IProduct[]
}

export interface IHeroCreateDTO extends Omit<IHeroSlide, '_id' | 'imageDesktop1' | 'imageDesktop2' | 'imageMobile1' | 'imageMobile2' | 'featuredProducts'> {
  featuredProducts: string;
  imageDesktop1: string;
  imageDesktop2?: string;
  imageMobile1: string;
  imageMobile2?: string;
  imageFiles: { [fieldname: string]: Express.Multer.File[] },
}

export interface IHeroImage {
  url: string;
  public_id: string;
  width?: number;
  height?: number;
}