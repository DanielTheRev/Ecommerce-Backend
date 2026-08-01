import { Schema, model } from 'mongoose';
import { INotificationDocument, NotificationType, NotificationSeverity } from '@/interfaces/notification.interface';

const notificationSchema = new Schema<INotificationDocument>(
	{
		user: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true
		},
		type: {
			type: String,
			enum: Object.values(NotificationType),
			default: NotificationType.GENERAL
		},
		severity: {
			type: String,
			enum: Object.values(NotificationSeverity),
			default: NotificationSeverity.INFO
		},
		title: {
			type: String,
			required: true,
			trim: true
		},
		message: {
			type: String,
			required: true,
			trim: true
		},
		read: {
			type: Boolean,
			default: false,
			index: true
		},
		data: {
			type: Schema.Types.Mixed,
			default: null
		},
		link: {
			type: String,
			default: null
		}
	},
	{
		timestamps: true,
		versionKey: false
	}
);

notificationSchema.index({ user: 1, createdAt: -1 });

export { notificationSchema };

export const Notification = model<INotificationDocument>('Notification', notificationSchema);
