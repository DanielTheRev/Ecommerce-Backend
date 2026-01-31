export enum NotificationType {
    // Orders
    NEW_ORDER = 'new_order',
    ORDER_STATUS_CHANGED = 'order_status_changed',
    
    // Payments
    PAYMENT_SUCCESS = 'payment_success',
    PAYMENT_FAILED = 'payment_failed',
    
    // System / Admin
    LOW_STOCK = 'low_stock',
    SYSTEM_ALERT = 'system_alert',
    
    // General
    WELCOME = 'welcome',
    GENERAL = 'general'
}

export enum NotificationSeverity {
    INFO = 'info',
    SUCCESS = 'success',
    WARNING = 'warning',
    ERROR = 'error'
}

export enum NotificationAudience {
    ADMIN = 'admin',
    USER = 'user',
    ALL = 'all'
}

// Base Notification Interface
export interface INotificationBase {
    id: string;
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    audience: NotificationAudience;
    link?: string;
    actionUrl?: string;
}

// Admin Specific Notification (Can include internal IDs, raw data, etc.)
export interface IAdminNotification<T = any> extends INotificationBase {
    audience: NotificationAudience.ADMIN;
    data?: T; // Raw data is often okay for admins
    actionUrl?: string; // Link to admin panel
}

// Client Specific Notification (Sanitized, friendly)
export interface IClientNotification<T = any> extends INotificationBase {
    audience: NotificationAudience.USER;
    data?: T; // Should be a sanitized DTO
    link?: string; // Link to public site
}

// Union type for use in method signatures
export type INotification = IAdminNotification | IClientNotification;

// DTOs for creating notifications (internal use)
export interface CreateAdminNotificationDto<T = any> {
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    data?: T;
    actionUrl?: string;
}

export interface CreateClientNotificationDto<T = any> {
    type: NotificationType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    data?: T;
    link?: string;
}
