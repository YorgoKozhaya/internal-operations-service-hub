import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequestRecord } from './request-record';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('demo/reset')
  resetDemoData(): RequestRecord[] {
    return this.requestsService.resetDemoData();
  }

  @Get(':id')
  findOne(@Param('id') id: string): RequestRecord {
    return this.requestsService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ): RequestRecord {
    return this.requestsService.updateStatus(id, status);
  }
}
