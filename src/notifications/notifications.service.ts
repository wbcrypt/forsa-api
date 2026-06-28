import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NotificationChannel } from '../common/enums';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private mailer: nodemailer.Transporter;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.mailer = nodemailer.createTransport({
      host: configService.get<string>('email.host'),
      port: configService.get<number>('email.port'),
      secure: configService.get<boolean>('email.secure'),
      auth: {
        user: configService.get<string>('email.user'),
        pass: configService.get<string>('email.password'),
      },
    });
  }

  async send(params: {
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
  }): Promise<void> {
    // Get template
    const [template] = await this.dataSource.query<any[]>(
      `SELECT * FROM notification_templates
       WHERE code = $1 AND channel = $2 AND is_active = true`,
      [params.templateCode, params.channel],
    );

    if (!template) {
      this.logger.warn(`No active template: ${params.templateCode} / ${params.channel}`);
      return;
    }

    const rendered = this.renderTemplate(template.body_template, params.variables);
    const subject = this.renderTemplate(template.subject_template || '', params.variables);

    let status = 'pending';
    let errorMessage: string | undefined;

    try {
      if (params.channel === NotificationChannel.EMAIL) {
        await this.sendEmail(params.recipientEmail, subject, rendered);
        status = 'sent';
      } else if (params.channel === NotificationChannel.SMS) {
        await this.sendSms(params.recipientPhone!, rendered);
        status = 'sent';
      } else if (params.channel === NotificationChannel.IN_APP) {
        status = 'delivered'; // In-app notifications are immediately available
      }
    } catch (err) {
      status = 'failed';
      errorMessage = (err as Error).message;
      this.logger.error(`Notification send failed: ${params.templateCode}`, err);
    }

    // Log notification (always, even on failure)
    await this.dataSource.query(
      `INSERT INTO notification_logs
        (tenant_id, template_id, recipient_id, recipient_email, recipient_phone,
         channel, subject, body, status, error_message, reference_id, reference_type,
         triggered_by, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
               CASE WHEN $9 = 'sent' THEN NOW() ELSE NULL END)`,
      [
        params.tenantId, template.id, params.recipientId,
        params.recipientEmail, params.recipientPhone,
        params.channel, subject, rendered, status, errorMessage,
        params.referenceId, params.referenceType, params.triggeredBy,
      ],
    ).catch(err => this.logger.error('Failed to log notification', err));
  }

  async sendBulk(notifications: Parameters<typeof this.send>[0][]): Promise<void> {
    await Promise.allSettled(notifications.map(n => this.send(n)));
  }

  async getNotificationsForUser(userId: string, tenantId: string, limit = 20) {
    return this.dataSource.query(
      `SELECT nl.id, nl.subject, nl.body, nl.channel, nl.status,
              nl.sent_at, nl.read_at, nl.reference_id, nl.reference_type
       FROM notification_logs nl
       WHERE nl.recipient_id = $1 AND nl.tenant_id = $2
         AND nl.channel = 'in_app'
       ORDER BY nl.created_at DESC
       LIMIT $3`,
      [userId, tenantId, limit],
    );
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE notification_logs SET read_at = NOW()
       WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL`,
      [notificationId, userId],
    );
  }

  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`,
    );
  }

  private async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.mailer.sendMail({
      from: `"${this.configService.get('email.fromName')}" <${this.configService.get('email.fromEmail')}>`,
      to,
      subject,
      html: body,
    });
  }

  private async sendSms(phone: string, body: string): Promise<void> {
    // Twilio / SMS provider integration placeholder
    // In production: integrate with Twilio or local SMS provider
    this.logger.log(`SMS to ${phone}: ${body.substring(0, 50)}...`);
  }
}
