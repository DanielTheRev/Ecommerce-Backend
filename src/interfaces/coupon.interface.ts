import { Document } from 'mongoose';

export type CouponDiscountType = 'percentage' | 'fixed';
export type CouponPaymentMethodRestriction = 'ALL' | 'TRANSFER' | 'CARD';

export interface ICouponUsedBy {
	email?: string;
	userId?: string;
	orderId?: string;
	usedAt: Date;
}

export interface ICouponCartItem {
	productId: string;
	category?: string;
	productType?: string;
	price: number;
	quantity: number;
}

export interface ICoupon {
	code: string; // Uppercase, unique code (e.g. PRIMERACOMPRA, VURA10)
	discountType: CouponDiscountType; // 'percentage' or 'fixed'
	discountValue: number; // e.g. 10 for 10% or 1500 for $1500 ARS
	minOrderAmount?: number; // Minimum order subtotal required
	maxUses?: number; // Total usage limit (null = unlimited)
	usedCount: number; // Number of times used
	usedBy: ICouponUsedBy[];
	isFirstPurchaseOnly?: boolean; // True if coupon is strictly for 1st-time buyers
	paymentMethodRestriction?: CouponPaymentMethodRestriction; // 'ALL' | 'TRANSFER' | 'CARD'
	applicableProductTypes?: string[]; // 'TechProduct' | 'ClothingProduct' | 'BeautyProduct' | 'GeneralProduct'
	applicableCategories?: string[]; // Category names or IDs
	applicableProducts?: string[]; // Product IDs
	assignedUserEmail?: string; // Optional: Link coupon exclusively to specific buyer email
	assignedUserId?: string; // Optional: Link coupon exclusively to specific userId
	expiresAt?: Date; // Optional expiration date
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface ICouponDocument extends Document, Omit<ICoupon, '_id'> {}

export interface ValidateCouponDTO {
	code: string;
	subtotal: number;
	email?: string;
	userId?: string;
	paymentMethod?: 'TRANSFER' | 'CARD' | 'MERCADOPAGO' | string;
	items?: ICouponCartItem[];
}

export interface ValidateCouponResult {
	isValid: boolean;
	code: string;
	discountType: CouponDiscountType;
	discountValue: number;
	discountAmount: number;
	finalTotal: number;
	message: string;
	isFirstPurchaseDiscount?: boolean;
}
