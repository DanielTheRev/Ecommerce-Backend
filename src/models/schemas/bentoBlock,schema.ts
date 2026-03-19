import { Schema } from 'mongoose';

export const BentoBlockSchema = new Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, required: false },
    link: { type: String, required: true },
    imageDesktop: {
      url: { type: String, required: true },
      public_id: { type: String, required: true }
    },
    imageMobile: {
      url: { type: String, required: false },
      public_id: { type: String, required: false }
    },
    isActive: { type: Boolean, default: false }
  },
  { _id: false } // No necesitamos un _id para los subdocumentos de los bloques
);
