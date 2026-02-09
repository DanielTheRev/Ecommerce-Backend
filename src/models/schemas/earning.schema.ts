import { Schema } from "mongoose";

export const EarningsSchema = new Schema({
  cash_transfer: { type: Number, default: 0 },
  card_3_installments: { type: Number, default: 0 },
  card_6_installments: { type: Number, default: 0 }
}, { _id: false });