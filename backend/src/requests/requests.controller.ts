import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateRequestInput } from './create-request.input';
import { IntakeResult } from './intake-rules';
import { IntakeService } from './intake.service';
import { RequestRecord, RequestSummary } from './request-record';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly intakeService: IntakeService,
  ) {}

  @Post('demo/reset')
  resetDemoData(): Promise<RequestRecord[]> {
    return this.requestsService.resetDemoData();
  }

  @Post('intake')
  @HttpCode(HttpStatus.OK)
  intake(
    @Headers('x-user-id') userId: string,
    @Body('text') text: string,
  ): Promise<IntakeResult> {
    return this.intakeService.interpret(userId, text);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Headers('x-user-id') userId: string,
    @Body() body: CreateRequestInput,
  ): Promise<RequestRecord> {
    return this.requestsService.create(userId, body);
  }

  @Get()
  list(
    @Headers('x-user-id') userId: string,
    @Query('status') status?: string,
  ): Promise<RequestSummary[]> {
    return this.requestsService.listForUser(userId, status);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ): Promise<RequestRecord> {
    return this.requestsService.findOneForUser(id, userId);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body('message') message: string,
  ): Promise<RequestRecord> {
    return this.requestsService.addComment(id, userId, message);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body('status') status: string,
    @Body('approverId') approverId?: string,
  ): Promise<RequestRecord> {
    return this.requestsService.updateStatus(id, status, userId, approverId);
  }
}
