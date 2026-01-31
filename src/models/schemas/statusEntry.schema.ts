import mongoose, { Schema } from 'mongoose';

export const statusEntrySchema = new Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: { type: String } // Ej: "Pago verificado manualmente"
}, { _id: false });