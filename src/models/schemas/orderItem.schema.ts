import { IOrderItem } from '@/interfaces/order.interface';
import mongoose, { Schema } from 'mongoose';

export const orderItemSchema = new Schema<IOrderItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    trim: true
  }
});