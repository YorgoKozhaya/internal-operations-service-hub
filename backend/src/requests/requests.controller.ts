import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CreateRequestInput } from './create-request.input';
import { RequestRecord } from './request-record';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('demo/reset')
  resetDemoData(): Promise<RequestRecord[]> {
    return this.requestsService.resetDemoData();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Headers('x-user-id') userId: string,
    @Body() body: CreateRequestInput,
  ): Promise<RequestRecord> {
    return this.requestsService.create(userId, body);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ): Promise<RequestRecord> {
    return this.requestsService.findOneForUser(id, userId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body('status') status: string,
  ): Promise<RequestRecord> {
    return this.requestsService.updateStatus(id, status, userId);
  }
}
