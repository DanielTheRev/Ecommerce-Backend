import { Document, ObjectId } from "mongoose";
import { IHeroImage } from "./hero.interface";

export interface IBentoBlock {
  title: string;
  subtitle?: string;
  link: string;
  imageDesktop: IHeroImage;
  imageMobile?: IHeroImage;
  isActive: boolean;
  gridSpan?: string;
  order?: number;
}

export interface IBentoItem {
  _id?: string;
  title: string;
  subtitle?: string;
  link: string;
  imageDesktop: IHeroImage;
  imageMobile?: IHeroImage;
  gridSpan?: string;
  order?: number;
  isActive?: boolean;
}

export interface IBentoConfigDocument extends Document {
  sectionTitle: string;
  sectionSubtitle: string;
  items?: IBentoItem[];
  blocks?: {
    mainBlock?: IBentoBlock;
    topRightBlock?: IBentoBlock;
    bottomRightBlock?: IBentoBlock;
    footerBlock?: IBentoBlock;
  };
}

export interface IBentoConfig {
  _id: ObjectId;
  sectionTitle: string;
  sectionSubtitle: string;
  items?: IBentoItem[];
  blocks?: {
    mainBlock?: IBentoBlock;
    topRightBlock?: IBentoBlock;
    bottomRightBlock?: IBentoBlock;
    footerBlock?: IBentoBlock;
  };
}

export interface IBentoConfigCreateDTO {
  sectionTitle?: string;
  sectionSubtitle?: string;
  items?: string | any[];
  blocks?: string | any;
  imageFiles?: { [fieldname: string]: Express.Multer.File[] };
}
