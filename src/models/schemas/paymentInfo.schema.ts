import { IPaymentInfo, PaymentStatus } from '@/interfaces/order.interface';
import { PaymentType } from '@/interfaces/paymentMethod.interface';
import mongoose, { Schema } from 'mongoose';

export const paymentInfoSchema = new Schema<IPaymentInfo>({
  method: {
    type: String,
    enum: Object.values(PaymentType),
    required: true
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
  },
  paymentDate: {
    type: Date
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  ualaOrderStatus: {
    type: Object,
    default: undefined
  },
  mercadopagoData: {
    type: Object,
    default: undefined
  }
});

paymentInfoSchema.pre('save', function (next) {
  // Generar transactionId si no existe
  if (!this.transactionId) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.transactionId = `TX-${timestamp}-${random}`;
  }
  // Guardar la fecha automáticamente si el estado del pago cambia
  if (this.isModified('status')) {
    this.paymentDate = new Date();
  }
  return next();
});
