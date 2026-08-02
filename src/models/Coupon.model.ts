import { Schema } from 'mongoose';
import { ICouponDocument } from '@/interfaces/coupon.interface';

const CouponUsedBySchema = new Schema(
	{
		email: { type: String, lowercase: true, trim: true },
		userId: { type: Schema.Types.ObjectId, ref: 'User' },
		orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
		usedAt: { type: Date, default: Date.now }
	},
	{ _id: false }
);

export const CouponSchema = new Schema<ICouponDocument>(
	{
		code: {
			type: String,
			required: true,
			unique: true,
			uppercase: true,
			trim: true,
			index: true
		},
		discountType: {
			type: String,
			enum: ['percentage', 'fixed'],
			default: 'percentage',
			required: true
		},
		discountValue: {
			type: Number,
			required: true,
			min: 0
		},
		minOrderAmount: {
			type: Number,
			default: 0
		},
		maxUses: {
			type: Number,
			default: null
		},
		usedCount: {
			type: Number,
			default: 0
		},
		usedBy: [CouponUsedBySchema],
		isFirstPurchaseOnly: {
			type: Boolean,
			default: false
		},
		assignedUserEmail: {
			type: String,
			lowercase: true,
			trim: true,
			default: null
		},
		assignedUserId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			default: null
		},
		expiresAt: {
			type: Date,
			default: null
		},
		isActive: {
			type: Boolean,
			default: true
		}
	},
	{
		timestamps: true
	}
);
