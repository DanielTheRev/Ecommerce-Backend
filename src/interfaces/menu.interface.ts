import { Document, Types } from 'mongoose';
import { IHeroImage } from './hero.interface';

export interface IMenuItemChild {
  _id?: Types.ObjectId | string;
  label: string;
  link: string;
  badge?: string;
  image?: IHeroImage | { url: string; public_id?: string };
  order: number;
  isActive: boolean;
}

export interface IMenuItem {
  _id?: Types.ObjectId | string;
  label: string;
  link: string;
  badge?: string;
  subtitle?: string;
  image?: IHeroImage | { url: string; public_id?: string };
  order: number;
  isActive: boolean;
  target?: '_self' | '_blank';
  children?: IMenuItemChild[];
}

export interface IMenu {
  _id?: Types.ObjectId | string;
  name: string;
  slug: string;
  description?: string;
  items: IMenuItem[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IMenuDocument extends Document, Omit<IMenu, '_id'> {
  _id: Types.ObjectId;
}

export interface IMenuCreateDTO {
  name: string;
  slug: string;
  description?: string;
  items: IMenuItem[];
  isActive?: boolean;
}
