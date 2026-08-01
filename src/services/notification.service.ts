import { TenantModels } from '../config/modelRegistry';
import { AppError } from '../errors/app.error';
import { CreateClientNotificationDto } from '../interfaces/notification.interface';

export class NotificationService {
	/**
	 * Crea y persiste una notificación para un usuario cliente en MongoDB.
	 */
	static async createClientNotification(models: TenantModels, userId: string, payload: CreateClientNotificationDto) {
		try {
			const notif = await models.Notification.create({
				user: userId,
				type: payload.type,
				severity: payload.severity,
				title: payload.title,
				message: payload.message,
				data: payload.data || null,
				link: payload.link || null,
				read: false
			});
			return notif;
		} catch (error) {
			console.error('Error saving notification to DB:', error);
			return null;
		}
	}

	/**
	 * Obtiene las notificaciones guardadas de un cliente (últimas 50).
	 */
	static async getUserNotifications(models: TenantModels, userId: string) {
		try {
			const notifs = await models.Notification.find({ user: userId })
				.sort({ createdAt: -1 })
				.limit(50)
				.lean();

			return notifs.map((n: any) => ({
				id: n._id.toString(),
				type: n.type,
				severity: n.severity,
				title: n.title,
				message: n.message,
				read: n.read,
				timestamp: n.createdAt,
				data: n.data,
				link: n.link
			}));
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al obtener notificaciones', 'Failed to fetch notifications', 500);
		}
	}

	/**
	 * Marca una notificación como leída.
	 */
	static async markAsRead(models: TenantModels, userId: string, notificationId: string) {
		try {
			await models.Notification.updateOne(
				{ _id: notificationId, user: userId },
				{ $set: { read: true } }
			);
			return { success: true };
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al marcar notificación como leída', 'Failed to mark notification as read', 500);
		}
	}

	/**
	 * Marca todas las notificaciones de un cliente como leídas.
	 */
	static async markAllAsRead(models: TenantModels, userId: string) {
		try {
			await models.Notification.updateMany(
				{ user: userId, read: false },
				{ $set: { read: true } }
			);
			return { success: true };
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al marcar todas las notificaciones como leídas', 'Failed to mark all as read', 500);
		}
	}

	/**
	 * Elimina una notificación específica.
	 */
	static async deleteNotification(models: TenantModels, userId: string, notificationId: string) {
		try {
			await models.Notification.deleteOne({ _id: notificationId, user: userId });
			return { success: true };
		} catch (error) {
			if (error instanceof AppError) throw error;
			throw new AppError('Error al eliminar notificación', 'Failed to delete notification', 500);
		}
	}
}
