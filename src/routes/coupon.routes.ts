import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';
import { optionalAuth, protect, adminOnly } from '../middleware/auth';

const router: Router = Router();

// Endpoints públicos / cliente
router.post('/validate', optionalAuth, CouponController.validateCoupon);
router.get('/check-first-purchase', optionalAuth, CouponController.checkFirstPurchase);
router.get('/my-coupons', optionalAuth, CouponController.getMyCoupons);

router.get('/first-purchase-config', protect, adminOnly, CouponController.getFirstPurchaseConfig);
router.patch('/first-purchase-config', protect, adminOnly, CouponController.updateFirstPurchaseConfig);

router.get('/', protect, adminOnly, CouponController.getAllCoupons);
router.post('/', protect, adminOnly, CouponController.createCoupon);
router.patch('/:id/toggle', protect, adminOnly, CouponController.toggleCoupon);
router.delete('/:id', protect, adminOnly, CouponController.deleteCoupon);

export default router;
