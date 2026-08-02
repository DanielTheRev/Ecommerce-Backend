import { Schema } from 'mongoose';
import { IOrderFinance } from '@/interfaces/order.interface';

export const orderFinanceSchema = new Schema<IOrderFinance>({
	total: { type: Number, required: true },
	baseCost: { type: Number, required: true, select: false },
	earnings: { type: Number, required: true, default: 0, select: false },
	totalOppositeCurrency: { type: Number },
	earningsOppositeCurrency: { type: Number, select: false },
	exchangeRateSnapshot: { type: Number },
	installments: { type: Number, required: true, default: 1 },
	paymentGatewayFee: { type: Number },
	couponCode: { type: String },
	couponDiscount: { type: Number, default: 0 }
});
