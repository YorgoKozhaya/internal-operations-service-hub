import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationRecord {
  notificationId: string;
  userId: string;
  requestId: string;
  message: string;
  createdAt: string;
  read: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<NotificationRecord[]> {
    await this.requireUser(userId);

    const notices = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return notices.map((notice) => this.toRecord(notice));
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationRecord> {
    await this.requireUser(userId);

    const notice = await this.prisma.notification.findUnique({
      where: { notificationId },
    });

    if (!notice) {
      throw new NotFoundException(`Notice ${notificationId} was not found.`);
    }

    if (notice.userId !== userId) {
      throw new ForbiddenException('You are not allowed to view this notice.');
    }

    const updated = await this.prisma.notification.update({
      where: { notificationId },
      data: { read: true },
    });

    return this.toRecord(updated);
  }

  async notify(
    recipientIds: string[],
    actorUserId: string,
    requestId: string,
    message: string,
  ): Promise<void> {
    const recipients = [...new Set(recipientIds)].filter((id) => id && id !== actorUserId);

    if (recipients.length === 0) {
      return;
    }

    const createdAt = new Date().toISOString();
    const stamp = Date.now();

    try {
      await this.prisma.notification.createMany({
        data: recipients.map((userId, index) => ({
          notificationId: `NOTE-${requestId}-${stamp}-${index}`,
          userId,
          requestId,
          message,
          createdAt,
          read: false,
        })),
      });
    } catch {
      // A notice problem must not undo the request that was already saved.
    }
  }

  private async requireUser(userId: string) {
    if (!userId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    return user;
  }

  private toRecord(notice: NotificationRecord): NotificationRecord {
    return {
      notificationId: notice.notificationId,
      userId: notice.userId,
      requestId: notice.requestId,
      message: notice.message,
      createdAt: notice.createdAt,
      read: notice.read,
    };
  }
}
