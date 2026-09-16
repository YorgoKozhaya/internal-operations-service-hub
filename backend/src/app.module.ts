import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [PrismaModule, RequestsModule],
  controllers: [HealthController],
})
export class AppModule {}
