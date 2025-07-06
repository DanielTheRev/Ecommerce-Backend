import mongoose, { Schema, Document } from 'mongoose';
import { IProduct } from '../types/product.types';

export interface IProductDocument extends Omit<IProduct, 'id'>, Document {
  _id: mongoose.Types.ObjectId;
}

const ProductSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  price: {
    type: Number,
    default: null,
    min: 0
  },
  discount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    max: 100
  },
  rating: {
    type: Number,
    default: null,
    min: 0,
    max: 5
  },
  reviews: {
    type: Number,
    default: null,
    min: 0
  },
  image: {
    light: {
      type: String,
      required: true,
      trim: true
    },
    dark: {
      type: String,
      required: true,
      trim: true
    }
  },
  features: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Índices para mejorar el rendimiento
ProductSchema.index({ name: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ rating: -1 });

export const Product = mongoose.model<IProductDocument>('Product', ProductSchema);
