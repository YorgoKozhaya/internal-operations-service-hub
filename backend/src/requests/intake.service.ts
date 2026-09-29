import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  INTAKE_ADVISOR,
  IntakeAdvisor,
  IntakeProviderError,
  InvalidIntakeOutputError,
} from './intake-advisor';
import {
  IntakeResult,
  ParsedIntake,
  categoryById,
  asksForEveryRequest,
  categoryMatchesMessage,
  isThinRequest,
  looksLikeStatusQuestion,
  matchingAreas,
  normalizeDepartment,
  parseModelOutput,
} from './intake-rules';

const STOP_WORDS = new Set([
  'what',
  'happened',
  'request',
  'requests',
  'status',
  'please',
  'about',
  'from',
  'with',
  'this',
  'that',
  'your',
  'have',
  'been',
  'does',
  'want',
  'know',
  'where',
  'update',
  'progress',
  'tell',
  'need',
  'help',
  'also',
  'mine',
]);

type VisibleRequest = {
  requestId: string;
  userId: string;
  title: string;
  description: string;
  status: string;
  date: string;
  categoryId: string;
  history: Array<{ status: string; updatedDate: string }>;
  comments: Array<{ authorName: string; message: string }>;
};

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INTAKE_ADVISOR) private readonly advisor: IntakeAdvisor,
  ) {}

  async interpret(userId: string, text: string | undefined): Promise<IntakeResult> {
    const message = text?.trim() ?? '';

    if (!userId) {
      throw new BadRequestException('Header x-user-id is required.');
    }

    if (!message) {
      throw new BadRequestException('Text is required.');
    }

    const actor = await this.prisma.user.findUnique({ where: { userId } });

    if (!actor) {
      throw new BadRequestException(`User ${userId} was not found.`);
    }

    const visible = await this.visibleRequests(actor.userId, actor.position, actor.departmentId);
    await this.assertMentionedRequestsAreVisible(message, visible);

    if (asksForEveryRequest(message)) {
      return this.listEveryRequest(actor.userId, actor.position, visible);
    }

    const categories = await this.prisma.requestCategory.findMany({
      orderBy: { categoryId: 'asc' },
    });
    let raw: unknown;

    try {
      raw = await this.advisor.advise(message, {
        categories: categories.map((category) => ({
          categoryId: category.categoryId,
          name: category.name,
          departmentId: category.departmentId,
        })),
        employeeRequests: visible.map((request) => ({
          requestId: request.requestId,
          title: request.title,
          status: request.status,
          comments: request.comments,
        })),
      });
    } catch (error) {
      if (isThinRequest(message) && error instanceof InvalidIntakeOutputError) {
        return this.clarification('Say whether this is for IT, HR, or Finance.');
      }

      this.rethrowAdvisorError(error);
    }

    let parsed: ParsedIntake;

    try {
      parsed = parseModelOutput(raw);
    } catch {
      if (isThinRequest(message)) {
        return this.clarification('Say whether this is for IT, HR, or Finance.');
      }

      throw new BadRequestException(
        'The AI provider returned an invalid intake result. No request was created.',
      );
    }

    if (looksLikeStatusQuestion(message) || parsed.requestType === 'status_question') {
      return this.answerStatus(message, parsed, visible);
    }

    return this.answerNewRequest(message, parsed);
  }

  private async answerNewRequest(message: string, parsed: ParsedIntake): Promise<IntakeResult> {
    if (isThinRequest(message)) {
      return this.clarification('Say whether this is for IT, HR, or Finance.');
    }

    const areas = matchingAreas(message);

    if (areas.length > 1) {
      return this.clarification('This matches more than one area. Choose IT, HR, or Finance.');
    }

    const known = categoryById(parsed.categoryId);
    const hinted = parsed.categoryId
      ? await this.prisma.requestCategory.findUnique({ where: { categoryId: parsed.categoryId } })
      : null;
    const area = areas.length === 1 ? categoryById(areas[0]) : null;
    const departmentId =
      area?.departmentId ?? hinted?.departmentId ?? known?.departmentId ?? normalizeDepartment(parsed.departmentId);

    if (!departmentId || (areas.length === 0 && !hinted && !known && parsed.needsClarification && !parsed.categoryName)) {
      return this.clarification(
        parsed.clarification ?? 'This hub accepts IT, HR, and Finance requests.',
      );
    }

    const stored = await this.prisma.requestCategory.findMany({
      where: { departmentId },
    });
    const similar = stored.filter((category) => categoryMatchesMessage(category.categoryId, category.name, message));
    const chosen = similar.length === 1 ? similar[0] : stored.find((category) => category.name.toLowerCase() === 'other');

    if (!chosen) {
      return this.clarification(parsed.clarification ?? 'Say whether this is for IT, HR, or Finance.');
    }

    return {
      requestType: 'new_request',
      categoryId: chosen.categoryId,
      categoryName: chosen.name,
      title: cleanTitle(parsed.title, message),
      needsApproval: null,
      departmentId,
      needsClarification: false,
      clarification: null,
      guidance: requestGuidance(departmentId, parsed.guidance),
      requestId: null,
      status: null,
      answer: null,
    };
  }

  private clarification(clarification: string): IntakeResult {
    return {
      requestType: 'new_request',
      categoryId: null,
      categoryName: null,
      title: null,
      needsApproval: null,
      departmentId: null,
      needsClarification: true,
      clarification,
      guidance: null,
      requestId: null,
      status: null,
      answer: null,
    };
  }

  private async listEveryRequest(
    userId: string,
    position: string,
    visible: VisibleRequest[],
  ): Promise<IntakeResult> {
    if (position === 'Department Employee') {
      return this.listDepartmentWorkload(userId, visible);
    }

    if (visible.length === 0) {
      return this.statusList('You have no requests yet.', true);
    }

    const lines = visible.map((request) => this.requestLine(request));
    return this.statusList(lines.join('\n'), false);
  }

  private async listDepartmentWorkload(
    userId: string,
    visible: VisibleRequest[],
  ): Promise<IntakeResult> {
    const owned = await this.prisma.request.findMany({
      where: { userId },
      orderBy: { requestId: 'asc' },
    });
    const responsible = visible.filter((request) => request.userId !== userId);
    const parts: string[] = [];

    if (owned.length === 0) {
      parts.push('You have no requests of your own.');
    } else {
      parts.push('Your requests:');
      parts.push(
        ...owned.map(
          (request) => `${request.requestId} (${request.title}) is ${request.status}.`,
        ),
      );
    }

    if (responsible.length === 0) {
      parts.push('There are no other requests in your department.');
    } else {
      parts.push('You are responsible for the progress of these requests:');
      parts.push(...responsible.map((request) => this.requestLine(request)));
    }

    return this.statusList(parts.join('\n'), false);
  }

  private requestLabel(request: { requestId: string; title: string }): string {
    return request.title ? `${request.requestId} (${request.title})` : request.requestId;
  }

  private requestLine(request: { requestId: string; title: string; status: string }): string {
    return `${this.requestLabel(request)} is ${request.status}.`;
  }

  private statusList(answer: string, needsClarification: boolean): IntakeResult {
    return {
      requestType: 'status_question',
      categoryId: null,
      categoryName: null,
      title: null,
      needsApproval: null,
      departmentId: null,
      needsClarification,
      clarification: needsClarification ? answer : null,
      guidance: null,
      requestId: null,
      status: null,
      answer: needsClarification ? null : answer,
    };
  }

  private answerStatus(
    message: string,
    parsed: ParsedIntake,
    visible: VisibleRequest[],
  ): IntakeResult {
    const match = this.matchRequest(message, parsed.requestId, visible);

    if (!match) {
      const list =
        visible.length > 0
          ? visible.map((request) => this.requestLabel(request)).join(', ')
          : 'none';

      return {
        requestType: 'status_question',
        categoryId: null,
        categoryName: null,
        title: null,
        needsApproval: null,
        departmentId: null,
        needsClarification: true,
        clarification: `Say which request you mean. Requests you can see: ${list}.`,
        guidance: null,
        requestId: null,
        status: null,
        answer: null,
      };
    }

    const category = categoryById(match.categoryId);
    const history = match.history.map((entry) => entry.status).join(', ');
    const comments = match.comments.length
      ? ` Comments: ${match.comments.map((comment) => `${comment.authorName}: ${comment.message}`).join('; ')}.`
      : '';

    return {
      requestType: 'status_question',
      categoryId: category?.categoryId ?? null,
      categoryName: category?.name ?? null,
      title: match.title,
      needsApproval: null,
      departmentId: category?.departmentId ?? null,
      needsClarification: false,
      clarification: null,
      guidance: null,
      requestId: match.requestId,
      status: match.status,
      answer: `${this.requestLabel(match)} is ${match.status}. History: ${history}.${comments}`,
    };
  }

  private matchRequest(
    message: string,
    modelRequestId: string | null,
    visible: VisibleRequest[],
  ): VisibleRequest | null {
    const mentioned = message.match(/REQ-\d+/g) ?? [];
    const mentionedVisible = unique(
      mentioned.filter((requestId) => visible.some((request) => request.requestId === requestId)),
    );

    if (mentionedVisible.length === 1) {
      return visible.find((request) => request.requestId === mentionedVisible[0]) ?? null;
    }

    if (mentionedVisible.length > 1) {
      return null;
    }

    if (modelRequestId && visible.some((request) => request.requestId === modelRequestId)) {
      return visible.find((request) => request.requestId === modelRequestId) ?? null;
    }

    const messageTokens = tokens(message);
    const scored = visible
      .map((request) => ({
        request,
        score: tokens(`${request.title} ${request.description}`).filter((token) =>
          messageTokens.includes(token),
        ).length,
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    if (scored.length === 0 || (scored.length > 1 && scored[0].score === scored[1].score)) {
      return null;
    }

    return scored[0].request;
  }

  private async visibleRequests(
    userId: string,
    position: string,
    departmentId: string,
  ): Promise<VisibleRequest[]> {
    const where =
      position === 'Administrator'
        ? {}
        : position === 'Department Employee'
          ? { departmentId }
          : position === 'Approver'
            ? { OR: [{ userId }, { approvals: { some: { approverId: userId } } }] }
            : { userId };

    const requests = await this.prisma.request.findMany({
      where,
      include: {
        history: { orderBy: { updatedDate: 'asc' } },
        comments: { orderBy: { createdAt: 'asc' }, include: { user: true } },
      },
      orderBy: { requestId: 'asc' },
    });

    const hideContent = position === 'Administrator';

    return requests.map((request) => ({
      requestId: request.requestId,
      userId: request.userId,
      title: hideContent ? '' : request.title,
      description: hideContent ? '' : request.description,
      status: request.status,
      date: request.date,
      categoryId: hideContent ? '' : request.categoryId,
      history: request.history.map((entry) => ({
        status: entry.status,
        updatedDate: entry.updatedDate,
      })),
      comments: hideContent
        ? []
        : request.comments.map((comment) => ({
            authorName: comment.user.name,
            message: comment.message,
          })),
    }));
  }

  private async assertMentionedRequestsAreVisible(
    message: string,
    visible: VisibleRequest[],
  ): Promise<void> {
    const mentioned = unique(message.match(/REQ-\d+/g) ?? []);

    for (const requestId of mentioned) {
      const row = await this.prisma.request.findUnique({ where: { requestId } });

      if (!row) {
        continue;
      }

      const allowed = visible.some((request) => request.requestId === requestId);

      if (!allowed) {
        throw new ForbiddenException('You are not allowed to view this request.');
      }
    }
  }

  private rethrowAdvisorError(error: unknown): never {
    if (error instanceof InvalidIntakeOutputError) {
      throw new BadRequestException(
        'The AI provider returned an invalid intake result. No request was created.',
      );
    }

    if (error instanceof IntakeProviderError && error.message.includes('not configured')) {
      throw new ServiceUnavailableException(
        'The AI provider is not configured. No request was created.',
      );
    }

    if (error instanceof IntakeProviderError && error.message.includes('not running')) {
      throw new ServiceUnavailableException(
        'The AI assistant is not available. You can still submit a request by yourself.',
      );
    }

    throw new ServiceUnavailableException(
      'The AI provider could not complete intake. No request was created.',
    );
  }
}

function requestGuidance(departmentId: string, modelGuidance: string | null): string {
  if (modelGuidance && /fill a request stating/i.test(modelGuidance)) {
    return modelGuidance.slice(0, 240);
  }

  if (departmentId === 'HR') {
    return 'Fill a request stating what happened and what you want HR to do.';
  }

  if (departmentId === 'FINANCE') {
    return 'Fill a request stating the amount and why Finance should handle it.';
  }

  return 'Fill a request stating what is not working and what you need IT to fix.';
}

function cleanTitle(title: string | null, fallback: string): string {
  const value = (title ?? fallback).replace(/\s+/g, ' ').trim();
  return value.slice(0, 120);
}

function tokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (word) => word.length > 3 && !STOP_WORDS.has(word),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
