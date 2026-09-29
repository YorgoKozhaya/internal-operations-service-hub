import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CategoryRecord } from './request-record';
import { RequestsService } from './requests.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get()
  findAll(@Headers('x-user-id') userId: string): Promise<CategoryRecord[]> {
    return this.requestsService.listCategories(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Headers('x-user-id') userId: string,
    @Body() body: { categoryId?: string; name?: string; departmentId?: string },
  ): Promise<CategoryRecord> {
    return this.requestsService.createCategory(userId, body);
  }

  @Patch(':id')
  rename(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body('name') name: string,
  ): Promise<CategoryRecord> {
    return this.requestsService.renameCategory(userId, id, name);
  }
}
