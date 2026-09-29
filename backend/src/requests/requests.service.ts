import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MailerService } from '../mail/mailer.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { seedDatabase } from '../prisma/seed-database';
import { CreateRequestInput } from './create-request.input';
import { CategoryRecord, RequestRecord, RequestSummary } from './request-record';
import {
  ALLOWED_TRANSITIONS,
  REQUEST_STATUSES,
  RequestStatus,
  isRequestStatus,
} from './request-status';

const requestInclude = {
  history: true,
  comments: { include: { user: true } },
  approvals: { include: { approver: true } },
} satisfies Prisma.RequestInclude;

type RequestWithRelations = Prisma.RequestGetPayload<{
  include: typeof requestInclude;
}>;

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mailer: MailerService,
  ) {}

  async findAll(): Promise<RequestRecord[]> {
    const requests = await this.prisma.request.findMany({
      include: requestInclude,
      orderBy: { requestId: 'asc' },
    });

    return requests.map((request) => this.toRecord(request));
  }

  async findOne(id: string): Promise<RequestRecord> {
    const request = await this.prisma.request.findUnique({
      where: { requestId: id },
      include: requestInclude,
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
    const isAdministrator = actor.position === 'Administrator';
    const isAssignedApprover = request.approvals.some((approval) => approval.approverId === userId);

    if (!isOwner && !isDepartmentStaff && !isAdministrator && !isAssignedApprover) {
      throw new ForbiddenException('You are not allowed to view this request.');
    }

    return isAdministrator ? this.hideRequestContent(request) : request;
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

    const departmentId = category.departmentId;
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
          emailUpdates: input.emailUpdates === true,
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

    const staff = await this.departmentStaff(departmentId);
    await this.notifications.notify(
      staff,
      userId,
      requestId,
      `${requestId} (${title}) was submitted.`,
    );

    if (input.emailUpdates === true) {
      await this.mailer.sendStatusEmail(user.email, requestId, title, 'Submitted');
    }

    return this.findOneForUser(requestId, userId);
  }

  async addComment(requestId: string, actorUserId: string, message: string | undefined): Promise<RequestRecord> {
    const text = message?.trim() ?? '';

    if (!text) {
      throw new BadRequestException('Comment is required.');
    }

    const request = await this.findOne(requestId);
    await this.assertDepartmentStaff(actorUserId, request);

    const commentId = `COMMENT-${requestId}-${Date.now()}`;
    const createdAt = new Date().toISOString();

    await this.prisma.comment.create({
      data: {
        commentId,
        requestId,
        userId: actorUserId,
        message: text,
        createdAt,
      },
    });

    await this.notifications.notify(
      [request.userId],
      actorUserId,
      requestId,
      `${requestId} (${request.title}) has a new comment.`,
    );

    return this.findOne(requestId);
  }

  async createCategory(
    actorUserId: string,
    input: { categoryId?: string; name?: string; departmentId?: string },
  ): Promise<CategoryRecord> {
    await this.requireAdministrator(actorUserId);
    const categoryId = input.categoryId?.trim() ?? '';
    const name = input.name?.trim() ?? '';
    const departmentId = input.departmentId?.trim() ?? '';

    if (!categoryId) {
      throw new BadRequestException('Category ID is required.');
    }

    if (!name) {
      throw new BadRequestException('Category name is required.');
    }

    if (!departmentId) {
      throw new BadRequestException('Department is required.');
    }

    const department = await this.prisma.department.findUnique({ where: { departmentId } });

    if (!department) {
      throw new BadRequestException(`Department ${departmentId} was not found.`);
    }

    const existing = await this.prisma.requestCategory.findUnique({ where: { categoryId } });

    if (existing) {
      throw new BadRequestException(`Category ${categoryId} already exists.`);
    }

    await this.assertCategoryNameIsFree(departmentId, name);

    const created = await this.prisma.requestCategory.create({
      data: { categoryId, name, departmentId },
    });

    return {
      categoryId: created.categoryId,
      name: created.name,
      departmentId: created.departmentId,
    };
  }

  async renameCategory(actorUserId: string, categoryId: string, name: string | undefined): Promise<CategoryRecord> {
    await this.requireAdministrator(actorUserId);
    const nextName = name?.trim() ?? '';

    if (!nextName) {
      throw new BadRequestException('Category name is required.');
    }

    const category = await this.prisma.requestCategory.findUnique({ where: { categoryId } });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} was not found.`);
    }

    await this.assertCategoryNameIsFree(category.departmentId, nextName, categoryId);

    const updated = await this.prisma.requestCategory.update({
      where: { categoryId },
      data: { name: nextName },
    });

    return {
      categoryId: updated.categoryId,
      name: updated.name,
      departmentId: updated.departmentId,
    };
  }

  async listForUser(userId: string, status?: string): Promise<RequestSummary[]> {
    const actor = await this.requireUser(userId);
    const statusFilter = status?.trim() ?? '';

    if (statusFilter && !isRequestStatus(statusFilter)) {
      throw new BadRequestException(
        `Invalid status. Allowed statuses are: ${REQUEST_STATUSES.join(', ')}.`,
      );
    }

    const where: Prisma.RequestWhereInput = {};

    if (actor.position === 'Department Employee') {
      where.departmentId = actor.departmentId;
    } else if (actor.position === 'Approver') {
      where.approvals = { some: { approverId: userId, decision: null } };
    } else if (actor.position !== 'Administrator') {
      where.userId = userId;
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    const requests = await this.prisma.request.findMany({
      where,
      orderBy: { requestId: 'asc' },
    });

    const hideContent = actor.position === 'Administrator';

    return requests.map((request) => {
      if (!isRequestStatus(request.status)) {
        throw new BadRequestException('Request must always have one current status.');
      }

      return {
        requestId: request.requestId,
        title: hideContent ? '' : request.title,
        status: request.status,
        date: request.date,
        userId: request.userId,
        departmentId: request.departmentId,
        categoryId: hideContent ? '' : request.categoryId,
      };
    });
  }

  async listCategories(userId: string): Promise<CategoryRecord[]> {
    await this.requireUser(userId);

    const categories = await this.prisma.requestCategory.findMany({
      orderBy: [{ departmentId: 'asc' }, { name: 'asc' }],
    });

    return categories.map((category) => ({
      categoryId: category.categoryId,
      name: category.name,
      departmentId: category.departmentId,
    }));
  }

  async updateStatus(
    id: string,
    nextStatus: string,
    actorUserId: string,
    approverId?: string,
  ): Promise<RequestRecord> {
    if (!actorUserId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    const request = await this.findOne(id);

    if (!isRequestStatus(nextStatus)) {
      throw new BadRequestException(
        `Invalid status. Allowed statuses are: ${REQUEST_STATUSES.join(', ')}.`,
      );
    }

    const decision = nextStatus === 'Approved' || nextStatus === 'Rejected';

    if (decision) {
      this.assertAssignedApprover(actorUserId, request);
    } else {
      await this.assertDepartmentStaff(actorUserId, request);
    }

    if (!this.canTransition(request.status, nextStatus)) {
      throw new BadRequestException(
        `Cannot transition request ${id} from ${request.status} to ${nextStatus}.`,
      );
    }

    const approver = nextStatus === 'Waiting for Approval'
      ? await this.requireDepartmentApprover(approverId, request.departmentId, request.userId)
      : null;

    const updatedAt = new Date().toISOString();
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
      updatedDate: updatedAt,
    });

    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.request.update({
        where: { requestId: id },
        data: { status: nextStatus },
      }),
      this.prisma.requestHistory.createMany({
        data: historyEntries,
      }),
    ];

    if (approver) {
      writes.push(
        this.prisma.approval.create({
          data: {
            approvalId: `APPROVAL-${id}-${nextHistoryNumber}`,
            approverId: approver.userId,
            requestId: id,
          },
        }),
      );
    }

    if (decision) {
      const openApproval = request.approvals.find((approval) => !approval.decision);

      if (!openApproval) {
        throw new BadRequestException(`Request ${id} has no approval waiting for a decision.`);
      }

      writes.push(
        this.prisma.approval.update({
          where: { approvalId: openApproval.approvalId },
          data: {
            decision: nextStatus,
            decisionDate: updatedAt,
          },
        }),
      );
    }

    await this.prisma.$transaction(writes);

    await this.notifications.notify(
      [request.userId],
      actorUserId,
      id,
      `${id} (${request.title}) is now ${nextStatus}.`,
    );

    if (approver) {
      await this.notifications.notify(
        [approver.userId],
        actorUserId,
        id,
        `${id} (${request.title}) is waiting for your approval.`,
      );
    }

    if (decision) {
      const staff = await this.departmentStaff(request.departmentId);
      const sentence =
        nextStatus === 'Approved'
          ? `${id} (${request.title}) was approved. You can resolve it.`
          : `${id} (${request.title}) was rejected. You can close it.`;

      await this.notifications.notify(staff, actorUserId, id, sentence);
    }

    if (request.emailUpdates) {
      const owner = await this.prisma.user.findUnique({ where: { userId: request.userId } });
      if (owner) {
        await this.mailer.sendStatusEmail(owner.email, id, request.title, nextStatus);
      }
    }

    return this.findOne(id);
  }

  private async departmentStaff(departmentId: string): Promise<string[]> {
    const staff = await this.prisma.user.findMany({
      where: {
        position: 'Department Employee',
        departmentId,
      },
      select: { userId: true },
    });

    return staff.map((person) => person.userId);
  }

  private canTransition(currentStatus: RequestStatus, nextStatus: RequestStatus): boolean {
    return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
  }

  private async assertDepartmentStaff(
    userId: string,
    request: { userId: string; departmentId: string },
  ): Promise<void> {
    const actor = await this.prisma.user.findUnique({
      where: { userId },
    });

    if (!actor) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    if (actor.userId === request.userId) {
      throw new ForbiddenException('You submitted this request, so someone else updates it.');
    }

    const canUpdate =
      actor.position === 'Department Employee' && actor.departmentId === request.departmentId;

    if (!canUpdate) {
      throw new ForbiddenException('Only a department employee can change this request status.');
    }
  }

  private assertAssignedApprover(userId: string, request: RequestRecord): void {
    if (request.userId === userId) {
      throw new ForbiddenException('You submitted this request, so someone else updates it.');
    }

    const openApproval = request.approvals.find((approval) => !approval.decision);

    if (!openApproval || openApproval.approverId !== userId) {
      throw new ForbiddenException('Only the assigned approver can approve or reject this request.');
    }
  }

  private async requireDepartmentApprover(
    approverId: string | undefined,
    departmentId: string,
    requesterId: string,
  ) {
    const chosenId = approverId?.trim() ?? '';

    if (!chosenId) {
      throw new BadRequestException(`Choose an approver from the ${departmentId} department.`);
    }

    const approver = await this.prisma.user.findUnique({
      where: { userId: chosenId },
    });

    if (approver?.userId === requesterId) {
      throw new BadRequestException('The person who submitted the request cannot approve it.');
    }

    if (!approver || approver.position !== 'Approver' || approver.departmentId !== departmentId) {
      throw new BadRequestException(
        `Approver ${chosenId} was not found in the ${departmentId} department.`,
      );
    }

    return approver;
  }

  private async assertCategoryNameIsFree(departmentId: string, name: string, exceptCategoryId?: string): Promise<void> {
    const categories = await this.prisma.requestCategory.findMany({ where: { departmentId } });
    const taken = categories.some(
      (category) =>
        category.categoryId !== exceptCategoryId && category.name.toLowerCase() === name.toLowerCase(),
    );

    if (taken) {
      throw new BadRequestException(`${name} already exists in ${departmentId}.`);
    }
  }

  private async requireAdministrator(userId: string) {
    const actor = await this.requireUser(userId);

    if (actor.position !== 'Administrator') {
      throw new ForbiddenException('Only an administrator can manage departments and categories.');
    }

    return actor;
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

  private async nextRequestId(): Promise<string> {
    const requests = await this.prisma.request.findMany({
      select: { requestId: true },
    });
    const numbers = requests.map((request) => Number(request.requestId.replace('REQ-', '')));
    const nextNumber = (numbers.length > 0 ? Math.max(...numbers) : 1000) + 1;

    return `REQ-${nextNumber}`;
  }

  private hideRequestContent(request: RequestRecord): RequestRecord {
    return {
      ...request,
      title: '',
      description: '',
      categoryId: '',
      comments: [],
    };
  }

  private toRecord(request: RequestWithRelations): RequestRecord {
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
      emailUpdates: request.emailUpdates,
      comments: [...request.comments]
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map((comment) => ({
          commentId: comment.commentId,
          requestId: comment.requestId,
          userId: comment.userId,
          authorName: comment.user.name,
          message: comment.message,
          createdAt: comment.createdAt,
        })),
      history: [...request.history]
        .sort((left, right) => left.updatedDate.localeCompare(right.updatedDate))
        .map((entry) => {
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
      approvals: request.approvals.map((approval) => ({
        approvalId: approval.approvalId,
        approverId: approval.approverId,
        approverName: approval.approver.name,
        requestId: approval.requestId,
        decision: approval.decision,
        decisionDate: approval.decisionDate,
      })),
    };
  }
}
