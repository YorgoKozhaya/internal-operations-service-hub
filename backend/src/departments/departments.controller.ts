import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { DepartmentRecord, DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  list(@Headers('x-user-id') userId: string): Promise<DepartmentRecord[]> {
    return this.departmentsService.list(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Headers('x-user-id') userId: string,
    @Body() body: { departmentId?: string; name?: string },
  ): Promise<DepartmentRecord> {
    return this.departmentsService.create(userId, body);
  }

  @Patch(':id')
  rename(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body('name') name: string,
  ): Promise<DepartmentRecord> {
    return this.departmentsService.rename(userId, id, name);
  }
}
