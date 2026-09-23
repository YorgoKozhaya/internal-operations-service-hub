import { Injectable } from '@nestjs/common';
import {
  EmployeeRequestContext,
  IntakeAdvisor,
  IntakeContext,
  IntakeProviderError,
  InvalidIntakeOutputError,
} from './intake-advisor';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

@Injectable()
export class GroqIntakeAdvisor implements IntakeAdvisor {
  async advise(text: string, context: IntakeContext): Promise<unknown> {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      throw new IntakeProviderError('The AI provider is not configured.');
    }

    const baseUrl = (process.env.GROQ_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
    const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

    const messages = [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: userPrompt(text, context) },
    ];
    let response: Response;

    try {
      response = await this.requestCompletion(baseUrl, apiKey, {
        model,
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages,
      });
    } catch (error) {
      if (!(error instanceof IntakeProviderError) || !error.message.includes('json_validate_failed')) {
        throw error;
      }

      response = await this.requestCompletion(baseUrl, apiKey, {
        model,
        temperature: 0,
        max_tokens: 1200,
        messages,
      });
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: Record<string, unknown> }>;
    };
    const message = body.choices?.[0]?.message ?? {};
    const content = [message.content, message.reasoning, message.reasoning_content].find(
      (value) => typeof value === 'string' && value.includes('{'),
    );

    if (typeof content !== 'string') {
      throw new InvalidIntakeOutputError();
    }

    try {
      return JSON.parse(extractJson(content));
    } catch {
      throw new InvalidIntakeOutputError();
    }
  }

  private async requestCompletion(
    baseUrl: string,
    apiKey: string,
    body: unknown,
  ): Promise<Response> {
    let lastError = 'The AI provider could not be reached.';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;

      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        lastError = 'The AI provider could not be reached.';
        await delay(1500 * (attempt + 1));
        continue;
      }

      if (response.ok) {
        return response;
      }

      const detail = await response.text().catch(() => '');
      lastError = `The AI provider returned ${response.status}.`;

      if (response.status !== 429 && response.status < 500) {
        if (detail.includes('json_validate_failed')) {
          lastError = `${lastError} json_validate_failed`;
        }

        throw new IntakeProviderError(lastError);
      }

      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * (attempt + 1);
      await delay(waitMs);
    }

    throw new IntakeProviderError(lastError);
  }
}

function systemPrompt(): string {
  return [
    'You classify one employee message for an internal service hub.',
    'Return a JSON object with keys requestType, categoryId, title, needsClarification, clarification, guidance, requestId.',
    'requestType is "new_request" or "status_question".',
    'Use status_question only when the employee asks what happened to an existing request, or asks for its status or progress.',
    'Use new_request when the employee wants something done.',
    'Allowed categories:',
    '- CAT-IT-1: IT. Hardware, laptops, accounts, and technical problems.',
    '- CAT-HR-1: HR. Employment letters, workplace issues, and talking to HR.',
    '- CAT-FIN-1: Finance. Expenses, reimbursement, and invoices.',
    'categoryId must be one of those ids, or null.',
    'If the message belongs to one area, set that categoryId and needsClarification to false.',
    'Do not ask which kind of IT, HR, or Finance help. The category is the area.',
    'If the message is thin, names two areas, asks for something outside those three, or invents a category, set needsClarification to true and categoryId to null.',
    'Never invent a category id.',
    'For status_question, set requestId only when one listed request matches. Otherwise set requestId to null and needsClarification to true.',
    'guidance is one sentence for a new request, beginning with "Fill a request stating", using the employee facts. Example: Fill a request stating that your manager is treating you badly and that you want HR to look into it. Use null when needsClarification is true or the message is a status question.',
    'title is a short summary for a new request, or null.',
    'clarification is a short sentence when needsClarification is true, otherwise null.',
  ].join('\n');
}

function userPrompt(text: string, context: IntakeContext): string {
  const requests = formatRequests(context.employeeRequests);

  return ['Employee requests this person is allowed to see:', requests, '', 'Employee message:', text].join(
    '\n',
  );
}

function formatRequests(requests: EmployeeRequestContext[]): string {
  if (requests.length === 0) {
    return 'None.';
  }

  return requests
    .map((request) => `- ${request.requestId} | ${request.title} | ${request.status}`)
    .join('\n');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end <= start) {
    return trimmed;
  }

  return trimmed.slice(start, end + 1);
}
