import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';
import { NextFunction, Response } from 'express';

export class NotificationController {
	static async getUserNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const notifications = await NotificationService.getUserNotifications(req.models!, userId);
			res.status(200).json(notifications);
		} catch (error) {
			next(error);
		}
	}

	static async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const { id } = req.params;
			const result = await NotificationService.markAsRead(req.models!, userId, id);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	static async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const result = await NotificationService.markAllAsRead(req.models!, userId);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}

	static async deleteNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const userId = req.user!._id.toString();
			const { id } = req.params;
			const result = await NotificationService.deleteNotification(req.models!, userId, id);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	}
}
