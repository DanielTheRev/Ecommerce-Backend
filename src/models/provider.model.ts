import mongoose, { Schema } from "mongoose";

// models/provider.model.ts
export const providerSchema = new Schema({
  name: { type: String, required: true },
  cuit: { type: String }, // ¡Ahora que sos monotributista vas a valorar pedir esto!
  contactEmail: { type: String },
  phone: { type: String },
  address: {
    street: String,
    number: String,
    city: String,
    province: String,
    zipCode: String // Clave para el endpoint de Andreani que encontraste [cite: 23]
  },
  active: { type: Schema.Types.Boolean, default: true }
}, { timestamps: true });

export const Provider = mongoose.model('Provider', providerSchema);