import { Module } from '@nestjs/common';
import { GroqIntakeAdvisor } from './groq-intake.advisor';
import { INTAKE_ADVISOR } from './intake-advisor';
import { IntakeService } from './intake.service';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  controllers: [RequestsController],
  providers: [
    RequestsService,
    IntakeService,
    GroqIntakeAdvisor,
    { provide: INTAKE_ADVISOR, useExisting: GroqIntakeAdvisor },
  ],
})
export class RequestsModule {}
