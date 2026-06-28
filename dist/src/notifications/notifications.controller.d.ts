import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly service;
    constructor(service: NotificationsService);
    getMyNotifications(userId: string, tenantId: string, limit: number): Promise<any>;
    markRead(id: string, userId: string): Promise<void>;
}
