import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '../common/enums';
export declare class NotificationsService {
    private readonly dataSource;
    private readonly configService;
    private readonly logger;
    private mailer;
    constructor(dataSource: DataSource, configService: ConfigService);
    send(params: {
        tenantId: string;
        recipientId: string;
        recipientEmail: string;
        recipientPhone?: string;
        channel: NotificationChannel;
        templateCode: string;
        variables: Record<string, unknown>;
        triggeredBy?: string;
        referenceId?: string;
        referenceType?: string;
    }): Promise<void>;
    sendBulk(notifications: Parameters<typeof this.send>[0][]): Promise<void>;
    getNotificationsForUser(userId: string, tenantId: string, limit?: number): Promise<any>;
    markRead(notificationId: string, userId: string): Promise<void>;
    private renderTemplate;
    private sendEmail;
    private sendSms;
}
