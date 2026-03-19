import { Schema, model } from 'mongoose';
import { IBentoConfigDocument } from '@/interfaces/bento.interface';
import { BentoBlockSchema } from './schemas/bentoBlock,schema';


const BentoConfigSchema = new Schema<IBentoConfigDocument>(
  {
    sectionTitle: { type: String, required: true },
    sectionSubtitle: { type: String, required: true },
    blocks: {
      mainBlock: { type: BentoBlockSchema, required: true },
      topRightBlock: { type: BentoBlockSchema, required: true },
      bottomRightBlock: { type: BentoBlockSchema, required: true },
      footerBlock: { type: BentoBlockSchema, required: true },
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
