import { Module } from '@nestjs/common';
import { MailerModule } from '../mail/mailer.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GroqIntakeAdvisor } from './groq-intake.advisor';
import { INTAKE_ADVISOR } from './intake-advisor';
import { IntakeService } from './intake.service';
import { CategoriesController } from './categories.controller';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [NotificationsModule, MailerModule],
  controllers: [RequestsController, CategoriesController],
  providers: [
    RequestsService,
    IntakeService,
    GroqIntakeAdvisor,
    { provide: INTAKE_ADVISOR, useExisting: GroqIntakeAdvisor },
  ],
})
export class RequestsModule {}
