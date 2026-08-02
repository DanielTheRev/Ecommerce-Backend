import { TenantModels } from '@/config/modelRegistry';
import { AppError } from '@/errors/app.error';
import {
	ICouponDocument,
	ValidateCouponDTO,
	ValidateCouponResult
} from '@/interfaces/coupon.interface';
import { OrderStatus, PaymentStatus } from '@/interfaces/order.interface';

import { EcommerceService } from './ecommerce.service';

export class CouponService {
	/**
	 * Valida si un usuario/email califica para el descuento automático de primera compra.
	 */
	static async checkFirstPurchaseEligibility(
		models: TenantModels,
		email?: string,
		userId?: string
	): Promise<{ isFirstPurchase: boolean; discountPercentage: number }> {
		const config = await EcommerceService.getConfig(models);
		const firstPurchaseConfig = config.firstPurchaseDiscount ?? { enabled: true, percentage: 10 };

		if (!firstPurchaseConfig.enabled) {
			return { isFirstPurchase: false, discountPercentage: 0 };
		}

		if (!email && !userId) {
			return { isFirstPurchase: true, discountPercentage: firstPurchaseConfig.percentage };
		}

		const queryConditions: any[] = [];
		if (userId) queryConditions.push({ user: userId });
		if (email) queryConditions.push({ 'buyerData.email': email.toLowerCase().trim() });

		const existingOrdersCount = await models.Order.countDocuments({
			$or: queryConditions,
			status: { $ne: OrderStatus.CANCELLED },
			'paymentInfo.status': { $ne: PaymentStatus.REJECTED }
		});

		return {
			isFirstPurchase: existingOrdersCount === 0,
			discountPercentage: firstPurchaseConfig.percentage
		};
	}

	/**
	 * Valida un código de cupón ingresado por el usuario en el checkout.
	 */
	static async validateCoupon(
		models: TenantModels,
		dto: ValidateCouponDTO
	): Promise<ValidateCouponResult> {
		const rawCode = (dto.code || '').trim().toUpperCase();
		if (!rawCode) {
			throw new AppError('Invalid coupon code', 'El código de cupón no puede estar vacío', 400);
		}

		// Buscar usuario si hay email o userId
		let userObj: any = null;
		const targetEmail = (dto.email || '').trim().toLowerCase();
		if (dto.userId) {
			userObj = await models.User.findById(dto.userId);
		} else if (targetEmail) {
			userObj = await models.User.findOne({ email: targetEmail });
		}

		// Caso especial: Código de Primera Compra 'PRIMERACOMPRA' o 'FIRST10'
		if (rawCode === 'PRIMERACOMPRA' || rawCode === 'FIRST10') {
			const isUsed = userObj?.rewards?.firstPurchaseUsed ?? false;
			if (isUsed) {
				return {
					isValid: false,
					code: rawCode,
					discountType: 'percentage',
					discountValue: 10,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'Ya has utilizado tu descuento de primera compra previamente.'
				};
			}

			const eligibility = await this.checkFirstPurchaseEligibility(models, dto.email, dto.userId);
			if (!eligibility.isFirstPurchase) {
				return {
					isValid: false,
					code: rawCode,
					discountType: 'percentage',
					discountValue: eligibility.discountPercentage || 10,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'El descuento de primera compra no se encuentra disponible para esta cuenta.'
				};
			}

			const perc = eligibility.discountPercentage || 10;
			const discountAmount = Math.round(dto.subtotal * (perc / 100));
			return {
				isValid: true,
				code: rawCode,
				discountType: 'percentage',
				discountValue: perc,
				discountAmount,
				finalTotal: Math.max(0, dto.subtotal - discountAmount),
				message: `¡Genial! Se aplicó tu ${perc}% OFF por Primera Compra.`,
				isFirstPurchaseDiscount: true
			};
		}

		// Caso especial: Cupón de Newsletter 'CLUBVURA10'
		if (rawCode === 'CLUBVURA10') {
			if (!userObj) {
				return {
					isValid: false,
					code: rawCode,
					discountType: 'percentage',
					discountValue: 10,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'Debés iniciar sesión con tu cuenta para utilizar el beneficio del Club Vura.'
				};
			}

			const isSubscribed = userObj.rewards?.newsletterSubscribed ?? false;
			const isUsed = userObj.rewards?.newsletterUsed ?? false;

			if (!isSubscribed) {
				return {
					isValid: false,
					code: rawCode,
					discountType: 'percentage',
					discountValue: 10,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'Debés suscribirte al newsletter en la Home para activar el beneficio del Club Vura.'
				};
			}

			if (isUsed) {
				return {
					isValid: false,
					code: rawCode,
					discountType: 'percentage',
					discountValue: 10,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'Ya has utilizado tu cupón de suscriptor del newsletter previamente.'
				};
			}

			const perc = 10;
			const discountAmount = Math.round(dto.subtotal * (perc / 100));
			return {
				isValid: true,
				code: rawCode,
				discountType: 'percentage',
				discountValue: perc,
				discountAmount,
				finalTotal: Math.max(0, dto.subtotal - discountAmount),
				message: '¡Genial! Se aplicó tu 10% OFF de Suscriptor del Club Vura.'
			};
		}

		// Buscar cupón en la base de datos
		const coupon = await models.Coupon.findOne({ code: rawCode });
		if (!coupon) {
			return {
				isValid: false,
				code: rawCode,
				discountType: 'percentage',
				discountValue: 0,
				discountAmount: 0,
				finalTotal: dto.subtotal,
				message: 'El código de cupón ingresado no existe.'
			};
		}

		if (!coupon.isActive) {
			return {
				isValid: false,
				code: rawCode,
				discountType: coupon.discountType,
				discountValue: coupon.discountValue,
				discountAmount: 0,
				finalTotal: dto.subtotal,
				message: 'Este cupón no se encuentra activo.'
			};
		}

		// Validar si el cupón está asignado a un usuario/email específico
		if (coupon.assignedUserEmail) {
			const userEmail = targetEmail;
			if (!userEmail || userEmail !== coupon.assignedUserEmail.toLowerCase()) {
				return {
					isValid: false,
					code: rawCode,
					discountType: coupon.discountType,
					discountValue: coupon.discountValue,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'Este cupón es exclusivo y no corresponde a tu correo electrónico.'
				};
			}
		}

		if (coupon.assignedUserId) {
			if (!dto.userId || String(dto.userId) !== String(coupon.assignedUserId)) {
				return {
					isValid: false,
					code: rawCode,
					discountType: coupon.discountType,
					discountValue: coupon.discountValue,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'Este cupón es exclusivo y no corresponde a tu usuario registrado.'
				};
			}
		}

		if (coupon.expiresAt && new Date() > coupon.expiresAt) {
			return {
				isValid: false,
				code: rawCode,
				discountType: coupon.discountType,
				discountValue: coupon.discountValue,
				discountAmount: 0,
				finalTotal: dto.subtotal,
				message: 'Este cupón ha expirado.'
			};
		}

		if (coupon.minOrderAmount && dto.subtotal < coupon.minOrderAmount) {
			return {
				isValid: false,
				code: rawCode,
				discountType: coupon.discountType,
				discountValue: coupon.discountValue,
				discountAmount: 0,
				finalTotal: dto.subtotal,
				message: `Este cupón requiere una compra mínima de $${coupon.minOrderAmount.toLocaleString('es-AR')}.`
			};
		}

		if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
			return {
				isValid: false,
				code: rawCode,
				discountType: coupon.discountType,
				discountValue: coupon.discountValue,
				discountAmount: 0,
				finalTotal: dto.subtotal,
				message: 'Este cupón ha alcanzado el límite máximo de usos.'
			};
		}

		// Verificar si el cupón es exclusivo para primera compra
		if (coupon.isFirstPurchaseOnly) {
			const eligibility = await this.checkFirstPurchaseEligibility(models, dto.email, dto.userId);
			if (!eligibility.isFirstPurchase) {
				return {
					isValid: false,
					code: rawCode,
					discountType: coupon.discountType,
					discountValue: coupon.discountValue,
					discountAmount: 0,
					finalTotal: dto.subtotal,
					message: 'Este cupón es exclusivo para la primera compra de un cliente nuevo.'
				};
			}
		}

		// Verificar si el usuario/email ya usó este cupón previamente
		const emailLower = targetEmail;
		const alreadyUsed = coupon.usedBy.some((usage: any) => {
			if (emailLower && usage.email && usage.email === emailLower) return true;
			if (dto.userId && usage.userId && String(usage.userId) === String(dto.userId)) return true;
			return false;
		});

		if (alreadyUsed) {
			return {
				isValid: false,
				code: rawCode,
				discountType: coupon.discountType,
				discountValue: coupon.discountValue,
				discountAmount: 0,
				finalTotal: dto.subtotal,
				message: 'Ya has utilizado este cupón de descuento previamente.'
			};
		}

		// Calcular monto del descuento
		let discountAmount = 0;
		if (coupon.discountType === 'percentage') {
			discountAmount = Math.round(dto.subtotal * (coupon.discountValue / 100));
		} else {
			discountAmount = Math.min(dto.subtotal, coupon.discountValue);
		}

		return {
			isValid: true,
			code: rawCode,
			discountType: coupon.discountType,
			discountValue: coupon.discountValue,
			discountAmount,
			finalTotal: Math.max(0, dto.subtotal - discountAmount),
			message: '¡Cupón de descuento aplicado con éxito!'
		};
	}

	/**
	 * Registra el uso de un cupón cuando una orden se aprueba o confirma.
	 */
	static async recordCouponUsage(
		models: TenantModels,
		code: string,
		orderId: string,
		email?: string,
		userId?: string
	): Promise<void> {
		const rawCode = (code || '').trim().toUpperCase();
		if (!rawCode) return;

		// Actualizar flags de rewards en el usuario si aplica a un cupón del sistema
		const targetEmail = (email || '').trim().toLowerCase();
		let userDoc: any = null;
		if (userId) {
			userDoc = await models.User.findById(userId);
		} else if (targetEmail) {
			userDoc = await models.User.findOne({ email: targetEmail });
		}

		if (userDoc) {
			if (!userDoc.rewards) {
				userDoc.rewards = {
					firstPurchaseEligible: true,
					firstPurchaseUsed: false,
					newsletterSubscribed: false,
					newsletterSubscribedAt: null,
					newsletterUsed: false,
					instagramClaimed: false,
					instagramUsed: false
				};
			}

			if (rawCode === 'PRIMERACOMPRA' || rawCode === 'FIRST10') {
				userDoc.rewards.firstPurchaseUsed = true;
				await userDoc.save();
				return;
			}
			if (rawCode === 'CLUBVURA10') {
				userDoc.rewards.newsletterUsed = true;
				await userDoc.save();
				return;
			}
			if (rawCode === 'VURAIG10' || rawCode.includes('IG') || rawCode.includes('INSTAGRAM')) {
				userDoc.rewards.instagramUsed = true;
				await userDoc.save();
			}
		}

		await models.Coupon.findOneAndUpdate(
			{ code: rawCode },
			{
				$inc: { usedCount: 1 },
				$push: {
					usedBy: {
						email: email ? email.toLowerCase().trim() : undefined,
						userId: userId || undefined,
						orderId,
						usedAt: new Date()
					}
				}
			}
		);
	}

	// ── MÉTODOS DE ADMINISTRACIÓN (Panel de Control) ──────────────────────

	static async getAllCoupons(models: TenantModels): Promise<ICouponDocument[]> {
		return models.Coupon.find().sort({ createdAt: -1 });
	}

	static async createCoupon(models: TenantModels, data: any): Promise<ICouponDocument> {
		const code = (data.code || '').trim().toUpperCase();
		if (!code) throw new AppError('Invalid code', 'El código del cupón es obligatorio', 400);

		const exists = await models.Coupon.findOne({ code });
		if (exists) throw new AppError('Coupon exists', 'Ya existe un cupón con este código', 400);

		return models.Coupon.create({
			...data,
			code
		});
	}

	static async toggleCouponStatus(models: TenantModels, id: string): Promise<ICouponDocument> {
		const coupon = await models.Coupon.findById(id);
		if (!coupon) throw new AppError('Not found', 'Cupón no encontrado', 404);

		coupon.isActive = !coupon.isActive;
		await coupon.save();
		return coupon;
	}

	static async deleteCoupon(models: TenantModels, id: string): Promise<void> {
		const result = await models.Coupon.findByIdAndDelete(id);
		if (!result) throw new AppError('Not found', 'Cupón no encontrado', 404);
	}

	static async getFirstPurchaseConfig(models: TenantModels) {
		const config = await EcommerceService.getConfig(models);
		return config.firstPurchaseDiscount ?? { enabled: true, percentage: 10 };
	}

	static async updateFirstPurchaseConfig(models: TenantModels, enabled: boolean, percentage: number) {
		const currentConfig = await EcommerceService.getConfig(models);
		const updated = await EcommerceService.updateConfig(models, {
			...currentConfig,
			firstPurchaseDiscount: {
				enabled: !!enabled,
				percentage: Number(percentage) || 10
			}
		});
		return updated.config.firstPurchaseDiscount;
	}

	static async getUserAvailableCoupons(models: TenantModels, email?: string, userId?: string) {
		const filter: any = { isActive: true };
		const now = new Date();

		const queryConditions: any[] = [
			{ assignedUserEmail: null, assignedUserId: null }
		];

		const targetEmail = (email || '').trim().toLowerCase();
		if (targetEmail) {
			queryConditions.push({ assignedUserEmail: targetEmail });
		}
		if (userId) {
			queryConditions.push({ assignedUserId: userId });
		}

		filter.$or = queryConditions;
		filter.$and = [
			{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }
		];

		const customCoupons = await models.Coupon.find(filter).sort({ createdAt: -1 }).lean();

		// Buscar usuario para agregar cupones virtuales de recompensas desbloqueados
		let userObj: any = null;
		if (userId) {
			userObj = await models.User.findById(userId).lean();
		} else if (targetEmail) {
			userObj = await models.User.findOne({ email: targetEmail }).lean();
		}

		const rewardCoupons: any[] = [];
		if (userObj && userObj.rewards) {
			const rewards = userObj.rewards;
			if (rewards.firstPurchaseEligible && !rewards.firstPurchaseUsed) {
				rewardCoupons.push({
					_id: 'reward_first_purchase',
					code: 'PRIMERACOMPRA',
					discountType: 'percentage',
					discountValue: 10,
					description: '10% OFF primera compra'
				});
			}
			if (rewards.newsletterSubscribed && !rewards.newsletterUsed) {
				rewardCoupons.push({
					_id: 'reward_newsletter',
					code: 'CLUBVURA10',
					discountType: 'percentage',
					discountValue: 10,
					description: '10% OFF Suscriptor Club Vura'
				});
			}
			if (rewards.instagramClaimed && !rewards.instagramUsed) {
				rewardCoupons.push({
					_id: 'reward_instagram',
					code: 'VURAIG10',
					discountType: 'percentage',
					discountValue: 10,
					description: '10% OFF Follower Instagram'
				});
			}
		}

		return [...rewardCoupons, ...customCoupons];
	}
}
