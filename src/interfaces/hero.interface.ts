import { ObjectId } from "mongoose";
import { IProduct } from "./product.interface";

export interface IHeroSlideDocument extends Document {
  title: string;
  imageDesktop: string;
  imageMobile: string;
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
  imageDesktop: IHeroImage;
  imageMobile: IHeroImage;
  sub_title: string, // "FW / 2026" (String)
  description: string, // "Prendas diseñadas para perdurar..." (String)
  ctaText: string, // "Comprar Colección" (String)
  ctaLink: string, // /products?collection=autumn-2026 o /collections/essentials (String)
  order: number;
  isActive: boolean;
  featuredProducts: IProduct[]
}

export interface IHeroCreateDTO extends Omit<IHeroSlide, '_id' | 'imageDesktop' | 'imageMobile' | 'featuredProducts'> {
  featuredProducts: string;
  imageDesktop: string;
  imageMobile: string;
  imageFiles: { [fieldname: string]: Express.Multer.File[] },
}

export interface IHeroImage {
  url: string;
  public_id: string;
  width?: number;
  height?: number;
}