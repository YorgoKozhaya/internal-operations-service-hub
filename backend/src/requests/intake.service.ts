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
  PRODUCT_CATEGORIES,
  IntakeResult,
  ParsedIntake,
  categoryById,
  asksForEveryRequest,
  isThinRequest,
  looksLikeStatusQuestion,
  matchingAreas,
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

    let raw: unknown;

    try {
      raw = await this.advisor.advise(message, {
        categories: PRODUCT_CATEGORIES,
        employeeRequests: visible.map((request) => ({
          requestId: request.requestId,
          title: request.title,
          status: request.status,
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

  private answerNewRequest(message: string, parsed: ParsedIntake): IntakeResult {
    if (isThinRequest(message)) {
      return this.clarification('Say whether this is for IT, HR, or Finance.');
    }

    const areas = matchingAreas(message);

    if (areas.length > 1) {
      return this.clarification('This matches more than one area. Choose IT, HR, or Finance.');
    }

    const category = areas.length === 1 ? categoryById(areas[0]) : categoryById(parsed.categoryId);

    if (!category || (areas.length === 0 && parsed.needsClarification)) {
      return this.clarification(
        parsed.clarification ?? 'This hub accepts IT, HR, and Finance requests.',
      );
    }

    return {
      requestType: 'new_request',
      categoryId: category.categoryId,
      categoryName: category.name,
      title: cleanTitle(parsed.title, message),
      needsApproval: category.needsApproval,
      needsClarification: false,
      clarification: null,
      guidance: requestGuidance(category.categoryId, parsed.guidance),
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
      needsApproval: false,
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

  private requestLine(request: { requestId: string; title: string; status: string }): string {
    return `${request.requestId} (${request.title}) is ${request.status}.`;
  }

  private statusList(answer: string, needsClarification: boolean): IntakeResult {
    return {
      requestType: 'status_question',
      categoryId: null,
      categoryName: null,
      title: null,
      needsApproval: false,
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
          ? visible.map((request) => `${request.requestId} (${request.title})`).join(', ')
          : 'none';

      return {
        requestType: 'status_question',
        categoryId: null,
        categoryName: null,
        title: null,
        needsApproval: false,
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

    return {
      requestType: 'status_question',
      categoryId: category?.categoryId ?? null,
      categoryName: category?.name ?? null,
      title: match.title,
      needsApproval: category?.needsApproval ?? false,
      needsClarification: false,
      clarification: null,
      guidance: null,
      requestId: match.requestId,
      status: match.status,
      answer: `${match.requestId} (${match.title}) is ${match.status}. History: ${history}.`,
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
      position === 'Department Employee' ? { departmentId } : { userId };

    const requests = await this.prisma.request.findMany({
      where,
      include: { history: { orderBy: { updatedDate: 'asc' } } },
      orderBy: { requestId: 'asc' },
    });

    return requests.map((request) => ({
      requestId: request.requestId,
      userId: request.userId,
      title: request.title,
      description: request.description,
      status: request.status,
      date: request.date,
      categoryId: request.categoryId,
      history: request.history.map((entry) => ({
        status: entry.status,
        updatedDate: entry.updatedDate,
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

    throw new ServiceUnavailableException(
      'The AI provider could not complete intake. No request was created.',
    );
  }
}

function requestGuidance(categoryId: string, modelGuidance: string | null): string {
  if (modelGuidance && /fill a request stating/i.test(modelGuidance)) {
    return modelGuidance.slice(0, 240);
  }

  if (categoryId === 'CAT-HR-1') {
    return 'Fill a request stating what happened and what you want HR to do.';
  }

  if (categoryId === 'CAT-FIN-1') {
    return 'Fill a request stating the expense and why it should be reimbursed.';
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
