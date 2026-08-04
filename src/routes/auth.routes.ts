import { Router } from 'express';
import { getUserProfile, LoginAdmin, loginUser, logout, sendOtp, verifyOtp } from '../controllers/auth.controller';
import { protect } from '@/middleware/auth';

const router: Router = Router();

router.post('/login', loginUser);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/admin/login', LoginAdmin);
router.post('/logout', logout);
router.get('/getUser', protect, getUserProfile);

export default router;
