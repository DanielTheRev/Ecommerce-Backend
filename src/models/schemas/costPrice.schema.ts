import { Schema } from "mongoose";

export const CostPriceSchema = new Schema({
  inUSD: {
    type: Number,
    required: true,
  },
  inARS: {
    type: Number,
    required: true,
  }
});