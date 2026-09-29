import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CreateUserInput } from './create-user.input';
import { UserRecord, UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Headers('x-user-id') userId: string,
    @Body() body: CreateUserInput,
  ): Promise<UserRecord> {
    return this.usersService.create(userId, body);
  }

  @Get('approvers')
  findApprovers(
    @Headers('x-user-id') userId: string,
    @Query('departmentId') departmentId: string,
  ): Promise<UserRecord[]> {
    return this.usersService.findApprovers(userId, departmentId);
  }
}
