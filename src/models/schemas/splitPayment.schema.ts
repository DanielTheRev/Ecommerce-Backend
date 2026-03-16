import { ISplitPayment, PaymentStatus } from '@/interfaces/order.interface';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import { Schema } from 'mongoose';

export const splitPaymentSchema = new Schema<ISplitPayment>({
  method: {
    type: String,
    enum: Object.values(PaymentType),
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
    default: PaymentStatus.PENDING
  },
  transactionId: {
    type: String,
    trim: true
  }
});
