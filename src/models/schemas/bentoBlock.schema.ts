import { Schema } from 'mongoose';

export const BentoBlockSchema = new Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, required: false },
    link: { type: String, required: true },
    imageDesktop: {
      url: { type: String, required: true },
      public_id: { type: String, required: false, default: '' }
    },
    imageMobile: {
      url: { type: String, required: false },
      public_id: { type: String, required: false, default: '' }
    },
    gridSpan: { type: String, required: false, default: 'main' },
    order: { type: Number, required: false, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { _id: true }
);
