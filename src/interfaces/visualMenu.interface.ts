import { Document, ObjectId } from "mongoose";
import { IHeroImage } from "./hero.interface";

export interface IVisualMenuItemChild {
  _id?: string;
  label: string;
  link: string;
  badge?: string;
  order?: number;
}

export interface IVisualMenuItem {
  _id?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  link: string;
  imageDesktop: IHeroImage;
  imageMobile?: IHeroImage;
  colSpanDesktop: number; // 1 to 12 (ej: 4, 6, 8, 12)
  colSpanTablet?: number; // 1 to 6 (ej: 3, 6)
  colSpanMobile?: number; // 1 to 2 (ej: 1, 2)
  rowSpanDesktop?: number; // 1 or 2
  order: number;
  isActive: boolean;
  children?: IVisualMenuItemChild[];
}

export interface IVisualMenuDocument extends Document {
  sectionTitle: string;
  sectionSubtitle: string;
  description?: string;
  displayMode: 'grid' | 'masonry' | 'carousel';
  items: IVisualMenuItem[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IVisualMenuConfig {
  _id?: ObjectId | string;
  sectionTitle: string;
  sectionSubtitle: string;
  description?: string;
  displayMode: 'grid' | 'masonry' | 'carousel';
  items: IVisualMenuItem[];
  isActive: boolean;
}

export interface IVisualMenuCreateDTO {
  sectionTitle?: string;
  sectionSubtitle?: string;
  description?: string;
  displayMode?: 'grid' | 'masonry' | 'carousel';
  items?: string | IVisualMenuItem[];
  isActive?: boolean | string;
  imageFiles?: { [fieldname: string]: Express.Multer.File[] };
}
