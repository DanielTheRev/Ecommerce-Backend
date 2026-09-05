import { Schema, model } from 'mongoose';
import { IVisualMenuDocument } from '@/interfaces/visualMenu.interface';

const ImageSchema = new Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    width: { type: Number },
    height: { type: Number }
  },
  { _id: false }
);

const VisualMenuItemChildSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    badge: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 }
  },
  { _id: true }
);

const VisualMenuItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: '' },
    badge: { type: String, trim: true, default: '' },
    link: { type: String, required: true, trim: true },
    imageDesktop: { type: ImageSchema, required: true },
    imageMobile: { type: ImageSchema, required: false },
    colSpanDesktop: { type: Number, default: 6, min: 1, max: 12 },
    colSpanTablet: { type: Number, default: 3, min: 1, max: 6 },
    colSpanMobile: { type: Number, default: 2, min: 1, max: 2 },
    rowSpanDesktop: { type: Number, default: 1, min: 1, max: 3 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    children: { type: [VisualMenuItemChildSchema], default: [] }
  },
  { _id: true }
);

const VisualMenuSchema = new Schema<IVisualMenuDocument>(
  {
    sectionTitle: { type: String, required: false, default: 'Vura / Catálogo' },
    sectionSubtitle: { type: String, required: false, default: 'Explorá la Colección.' },
    description: { type: String, required: false, default: '' },
    displayMode: { type: String, enum: ['grid', 'masonry', 'carousel'], default: 'grid' },
    items: { type: [VisualMenuItemSchema], default: [] },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export { VisualMenuSchema, VisualMenuItemSchema, VisualMenuItemChildSchema };
export const VisualMenu = model<IVisualMenuDocument>('VisualMenu', VisualMenuSchema);
