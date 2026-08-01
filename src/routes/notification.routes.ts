import { NotificationController } from '../controllers/notification.controller';
import { protect } from '../middleware/auth';
import { Router } from 'express';

const router: Router = Router();

router.use(protect);

router.get('/', NotificationController.getUserNotifications);
router.patch('/read-all', NotificationController.markAllAsRead);
router.patch('/:id/read', NotificationController.markAsRead);
router.delete('/:id', NotificationController.deleteNotification);

export default router;
