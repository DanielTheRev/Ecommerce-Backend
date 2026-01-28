import { IShippingInfo } from '@/interfaces/order.interface';
import { ShippingType } from '@/interfaces/shippingMethods.interface';
import mongoose, { Schema } from 'mongoose';

export const shippingInfoSchema = new Schema<IShippingInfo>({
  type: {
    type: String,
    enum: Object.values(ShippingType),
    required: true
  },
  pickupPoint: {
    name: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  // shippingAddress: {
  // 	type: shippingAddressSchema,
  // 	required: function () {
  // 		return this.type === ShippingType.HOME_DELIVERY;
  // 	}
  // },
  cost: {
    type: Number,
    required: true,
    min: 0
  }
});

