import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DepartmentRecord {
  departmentId: string;
  name: string;
}

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actorUserId: string): Promise<DepartmentRecord[]> {
    await this.requireUser(actorUserId);

    const departments = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
    });

    return departments.map((department) => ({
      departmentId: department.departmentId,
      name: department.name,
    }));
  }

  async create(actorUserId: string, input: { departmentId?: string; name?: string }): Promise<DepartmentRecord> {
    await this.requireAdministrator(actorUserId);
    const departmentId = input.departmentId?.trim() ?? '';
    const name = input.name?.trim() ?? '';

    if (!departmentId) {
      throw new BadRequestException('Department ID is required.');
    }

    if (!name) {
      throw new BadRequestException('Department name is required.');
    }

    const existing = await this.prisma.department.findUnique({ where: { departmentId } });

    if (existing) {
      throw new BadRequestException(`Department ${departmentId} already exists.`);
    }

    const created = await this.prisma.department.create({
      data: { departmentId, name },
    });

    return { departmentId: created.departmentId, name: created.name };
  }

  async rename(actorUserId: string, departmentId: string, name: string | undefined): Promise<DepartmentRecord> {
    await this.requireAdministrator(actorUserId);
    const nextName = name?.trim() ?? '';

    if (!nextName) {
      throw new BadRequestException('Department name is required.');
    }

    const department = await this.prisma.department.findUnique({ where: { departmentId } });

    if (!department) {
      throw new NotFoundException(`Department ${departmentId} was not found.`);
    }

    const updated = await this.prisma.department.update({
      where: { departmentId },
      data: { name: nextName },
    });

    return { departmentId: updated.departmentId, name: updated.name };
  }

  private async requireAdministrator(userId: string) {
    const actor = await this.requireUser(userId);

    if (actor.position !== 'Administrator') {
      throw new ForbiddenException('Only an administrator can manage departments and categories.');
    }
  }

  private async requireUser(userId: string) {
    if (!userId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    const user = await this.prisma.user.findUnique({ where: { userId } });

    if (!user) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    return user;
  }
}
