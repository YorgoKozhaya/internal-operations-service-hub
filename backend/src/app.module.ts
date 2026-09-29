import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DepartmentsModule } from './departments/departments.module';
import { HealthController } from './health.controller';
import { LogsService } from './logs.service';
import { MonitorController } from './monitor.controller';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestLogInterceptor } from './request-log.interceptor';
import { StatusService } from './status.service';
import { RequestsModule } from './requests/requests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, NotificationsModule, RequestsModule, UsersModule, DepartmentsModule],
  controllers: [HealthController, MonitorController],
  providers: [
    LogsService,
    StatusService,
    { provide: APP_INTERCEPTOR, useClass: RequestLogInterceptor },
  ],
})
export class AppModule {}
