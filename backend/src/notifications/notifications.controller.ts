import { Controller, Get, Headers, Param, Patch } from '@nestjs/common';
import { NotificationRecord, NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Headers('x-user-id') userId: string): Promise<NotificationRecord[]> {
    return this.notificationsService.list(userId);
  }

  @Patch(':id/read')
  markRead(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string,
  ): Promise<NotificationRecord> {
    return this.notificationsService.markRead(userId, id);
  }
}
