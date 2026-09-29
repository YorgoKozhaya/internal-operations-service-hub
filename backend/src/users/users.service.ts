import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserInput } from './create-user.input';

const POSITIONS = ['Employee', 'Department Employee', 'Approver', 'Administrator'] as const;

export interface UserRecord {
  userId: string;
  name: string;
  email: string;
  position: string;
  departmentId: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actorUserId: string, input: CreateUserInput): Promise<UserRecord> {
    const actor = await this.requireUser(actorUserId);

    if (actor.position !== 'Administrator') {
      throw new ForbiddenException('Only an administrator can add a user.');
    }

    const userId = input.userId?.trim() ?? '';
    const name = input.name?.trim() ?? '';
    const email = input.email?.trim() ?? '';
    const position = input.position?.trim() ?? '';
    const departmentId = input.departmentId?.trim() ?? '';

    if (!userId) {
      throw new BadRequestException('User ID is required.');
    }

    if (!name) {
      throw new BadRequestException('Name is required.');
    }

    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    if (!position) {
      throw new BadRequestException('Position is required.');
    }

    if (!POSITIONS.includes(position as (typeof POSITIONS)[number])) {
      throw new BadRequestException(
        `Invalid position. Allowed positions are: ${POSITIONS.join(', ')}.`,
      );
    }

    if (!departmentId) {
      throw new BadRequestException('Department is required.');
    }

    const department = await this.prisma.department.findUnique({
      where: { departmentId },
    });

    if (!department) {
      throw new BadRequestException(`Department ${departmentId} was not found.`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (existingUser) {
      throw new BadRequestException(`User ${userId} already exists.`);
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      throw new BadRequestException(`Email ${email} is already used.`);
    }

    const created = await this.prisma.user.create({
      data: {
        userId,
        name,
        email,
        position,
        departmentId,
      },
    });

    return this.toRecord(created);
  }

  async findApprovers(actorUserId: string, departmentId: string | undefined): Promise<UserRecord[]> {
    const actor = await this.requireUser(actorUserId);
    const department = departmentId?.trim() ?? '';

    if (!department) {
      throw new BadRequestException('Department is required.');
    }

    const canList =
      actor.position === 'Administrator' ||
      (actor.position === 'Department Employee' && actor.departmentId === department);

    if (!canList) {
      throw new ForbiddenException('You are not allowed to view approvers for this department.');
    }

    const approvers = await this.prisma.user.findMany({
      where: {
        position: 'Approver',
        departmentId: department,
      },
      orderBy: { name: 'asc' },
    });

    return approvers.map((approver) => this.toRecord(approver));
  }

  private async requireUser(userId: string) {
    if (!userId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    return user;
  }

  private toRecord(user: UserRecord): UserRecord {
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      position: user.position,
      departmentId: user.departmentId,
    };
  }
}
