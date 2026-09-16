import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { seedDatabase } from '../prisma/seed-database';
import { CreateRequestInput } from './create-request.input';
import { RequestRecord } from './request-record';
import {
  ALLOWED_TRANSITIONS,
  REQUEST_STATUSES,
  RequestStatus,
  isRequestStatus,
} from './request-status';

type RequestWithHistory = Prisma.RequestGetPayload<{
  include: { history: true };
}>;

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RequestRecord[]> {
    const requests = await this.prisma.request.findMany({
      include: { history: true },
      orderBy: { requestId: 'asc' },
    });

    return requests.map((request) => this.toRecord(request));
  }

  async findOne(id: string): Promise<RequestRecord> {
    const request = await this.prisma.request.findUnique({
      where: { requestId: id },
      include: { history: { orderBy: { updatedDate: 'asc' } } },
    });

    if (!request) {
      throw new NotFoundException(`Request ${id} was not found.`);
    }

    return this.toRecord(request);
  }

  async findOneForUser(id: string, userId: string): Promise<RequestRecord> {
    if (!userId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    const request = await this.findOne(id);
    const actor = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!actor) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    const isOwner = request.userId === userId;
    const isDepartmentStaff =
      actor.position === 'Department Employee' && actor.departmentId === request.departmentId;

    if (!isOwner && !isDepartmentStaff) {
      throw new ForbiddenException('You are not allowed to view this request.');
    }

    return request;
  }

  async resetDemoData(): Promise<RequestRecord[]> {
    await seedDatabase(this.prisma);
    return this.findAll();
  }

  async create(userId: string, input: CreateRequestInput): Promise<RequestRecord> {
    const title = input.title?.trim() ?? '';
    const description = input.description?.trim() ?? '';
    const categoryId = input.categoryId?.trim() ?? '';

    if (!userId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    if (!title) {
      throw new BadRequestException('Title is required.');
    }

    if (!categoryId) {
      throw new BadRequestException('Category is required.');
    }

    const user = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    const category = await this.prisma.requestCategory.findUnique({
      where: { categoryId },
    });

    if (!category) {
      throw new BadRequestException(`Category ${categoryId} was not found.`);
    }

    const departmentId = this.departmentForCategory(categoryId);
    const requestId = await this.nextRequestId();
    const submittedAt = new Date().toISOString();
    const date = submittedAt.slice(0, 10);

    await this.prisma.$transaction([
      this.prisma.request.create({
        data: {
          requestId,
          title,
          description,
          status: 'Submitted',
          date,
          userId,
          departmentId,
          categoryId,
        },
      }),
      this.prisma.requestHistory.create({
        data: {
          historyId: `HIST-${requestId}-1`,
          requestId,
          status: 'Submitted',
          updatedDate: submittedAt,
        },
      }),
    ]);

    return this.findOne(requestId);
  }

  async updateStatus(id: string, nextStatus: string, actorUserId: string): Promise<RequestRecord> {
    if (!actorUserId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    const request = await this.findOne(id);
    await this.assertDepartmentStaff(actorUserId, request.departmentId);

    if (!request.status) {
      throw new BadRequestException('Request must always have one current status.');
    }

    if (!isRequestStatus(nextStatus)) {
      throw new BadRequestException(
        `Invalid status. Allowed statuses are: ${REQUEST_STATUSES.join(', ')}.`,
      );
    }

    if (!this.canTransition(request.status, nextStatus)) {
      throw new BadRequestException(
        `Cannot transition request ${id} from ${request.status} to ${nextStatus}.`,
      );
    }

    const historyEntries: Array<{
      historyId: string;
      requestId: string;
      status: string;
      updatedDate: string;
    }> = [];
    let nextHistoryNumber = request.history.length + 1;

    if (request.history.length === 0) {
      historyEntries.push({
        historyId: `HIST-${id}-${nextHistoryNumber}`,
        requestId: id,
        status: request.status,
        updatedDate: `${request.date}T09:00:00.000Z`,
      });
      nextHistoryNumber += 1;
    }

    historyEntries.push({
      historyId: `HIST-${id}-${nextHistoryNumber}`,
      requestId: id,
      status: nextStatus,
      updatedDate: new Date().toISOString(),
    });

    await this.prisma.$transaction([
      this.prisma.request.update({
        where: { requestId: id },
        data: { status: nextStatus },
      }),
      this.prisma.requestHistory.createMany({
        data: historyEntries,
      }),
    ]);

    return this.findOne(id);
  }

  private canTransition(currentStatus: RequestStatus, nextStatus: RequestStatus): boolean {
    return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
  }

  private async assertDepartmentStaff(userId: string, departmentId: string): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!actor) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    const canUpdate =
      actor.position === 'Department Employee' && actor.departmentId === departmentId;

    if (!canUpdate) {
      throw new ForbiddenException('Only a department employee can change this request status.');
    }
  }

  private departmentForCategory(categoryId: string): string {
    const departments: Record<string, string> = {
      'CAT-IT-1': 'IT',
      'CAT-HR-1': 'HR',
      'CAT-FIN-1': 'FINANCE',
    };

    const departmentId = departments[categoryId];

    if (!departmentId) {
      throw new BadRequestException(`Category ${categoryId} has no assigned department.`);
    }

    return departmentId;
  }

  private async nextRequestId(): Promise<string> {
    const requests = await this.prisma.request.findMany({
      select: { requestId: true },
    });
    const numbers = requests.map((request) => Number(request.requestId.replace('REQ-', '')));
    const nextNumber = (numbers.length > 0 ? Math.max(...numbers) : 1000) + 1;

    return `REQ-${nextNumber}`;
  }

  private toRecord(request: RequestWithHistory): RequestRecord {
    if (!isRequestStatus(request.status)) {
      throw new BadRequestException('Request must always have one current status.');
    }

    return {
      requestId: request.requestId,
      title: request.title,
      description: request.description,
      status: request.status,
      date: request.date,
      userId: request.userId,
      departmentId: request.departmentId,
      categoryId: request.categoryId,
      history: request.history.map((entry) => {
        if (!isRequestStatus(entry.status)) {
          throw new BadRequestException('Request must always have one current status.');
        }

        return {
          historyId: entry.historyId,
          requestId: entry.requestId,
          status: entry.status,
          updatedDate: entry.updatedDate,
        };
      }),
    };
  }
}
