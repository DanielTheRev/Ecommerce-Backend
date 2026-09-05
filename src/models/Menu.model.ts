import { Schema, model } from 'mongoose';
import { IMenuDocument } from '@/interfaces/menu.interface';

const ImageSchema = new Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    width: { type: Number },
    height: { type: Number }
  },
  { _id: false }
);

const MenuItemChildSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    badge: { type: String, trim: true, default: '' },
    image: { type: ImageSchema, required: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { _id: true }
);

const MenuItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    badge: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    image: { type: ImageSchema, required: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    target: { type: String, enum: ['_self', '_blank'], default: '_self' },
    children: { type: [MenuItemChildSchema], default: [] }
  },
  { _id: true }
);

const MenuSchema = new Schema<IMenuDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, index: true },
    description: { type: String, trim: true, default: '' },
    items: { type: [MenuItemSchema], default: [] },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export { MenuSchema, MenuItemSchema, MenuItemChildSchema };
export const Menu = model<IMenuDocument>('Menu', MenuSchema);
