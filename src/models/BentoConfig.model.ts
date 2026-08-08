import { Schema, model } from 'mongoose';
import { IBentoConfigDocument } from '@/interfaces/bento.interface';
import { BentoBlockSchema } from './schemas/bentoBlock,schema';

const BentoConfigSchema = new Schema<IBentoConfigDocument>(
  {
    sectionTitle: { type: String, required: false, default: 'Vura / Catálogo' },
    sectionSubtitle: { type: String, required: false, default: 'Explorá la Selección.' },
    items: [BentoBlockSchema],
    blocks: {
      mainBlock: { type: BentoBlockSchema, required: false },
      topRightBlock: { type: BentoBlockSchema, required: false },
      bottomRightBlock: { type: BentoBlockSchema, required: false },
      footerBlock: { type: BentoBlockSchema, required: false },
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Schema exportado para multi-tenancy (model registry)
export { BentoConfigSchema };

export const BentoConfig = model<IBentoConfigDocument>('BentoConfig', BentoConfigSchema);
