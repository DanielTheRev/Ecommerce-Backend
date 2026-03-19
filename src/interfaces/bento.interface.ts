import { Document, ObjectId } from "mongoose";
import { IHeroImage } from "./hero.interface";

export interface IBentoBlock {
  title: string;
  subtitle?: string;
  link: string;
  imageDesktop: IHeroImage;
  imageMobile?: IHeroImage;
  isActive: boolean;
}

export interface IBentoConfigDocument extends Document {
  sectionTitle: string;
  sectionSubtitle: string;
  blocks: {
    mainBlock: IBentoBlock;
    topRightBlock: IBentoBlock;
    bottomRightBlock: IBentoBlock;
    footerBlock: IBentoBlock;
  };
}

export interface IBentoConfig {
  _id: ObjectId;
  sectionTitle: string;
  sectionSubtitle: string;
  blocks: {
    mainBlock: IBentoBlock;
    topRightBlock: IBentoBlock;
    bottomRightBlock: IBentoBlock;
    footerBlock: IBentoBlock;
  };
}

export interface IBentoConfigCreateDTO {
  sectionTitle: string;
  sectionSubtitle: string;
  blocks: string | {
    mainBlock: Omit<IBentoBlock, 'imageDesktop' | 'imageMobile'> & { imageDesktop?: string | IHeroImage, imageMobile?: string | IHeroImage };
    topRightBlock: Omit<IBentoBlock, 'imageDesktop' | 'imageMobile'> & { imageDesktop?: string | IHeroImage, imageMobile?: string | IHeroImage };
    bottomRightBlock: Omit<IBentoBlock, 'imageDesktop' | 'imageMobile'> & { imageDesktop?: string | IHeroImage, imageMobile?: string | IHeroImage };
    footerBlock: Omit<IBentoBlock, 'imageDesktop' | 'imageMobile'> & { imageDesktop?: string | IHeroImage, imageMobile?: string | IHeroImage };
  };
  imageFiles?: { [fieldname: string]: Express.Multer.File[] };
}
