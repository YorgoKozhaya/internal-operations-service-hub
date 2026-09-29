import { Injectable } from '@nestjs/common';
import {
  IntakeAdvisor,
  IntakeContext,
  IntakeProviderError,
  InvalidIntakeOutputError,
} from './intake-advisor';

const DEFAULT_AI_BASE_URL = 'http://127.0.0.1:4000';

@Injectable()
export class GroqIntakeAdvisor implements IntakeAdvisor {
  async advise(text: string, context: IntakeContext): Promise<unknown> {
    const baseUrl = (process.env.AI_BASE_URL?.trim() || DEFAULT_AI_BASE_URL).replace(/\/$/, '');
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          employeeRequests: context.employeeRequests,
          categories: context.categories,
        }),
        signal: AbortSignal.timeout(35000),
      });
    } catch {
      throw new IntakeProviderError('The AI service is not running.');
    }

    const body = await response.json().catch(() => ({}));
    const message = typeof body?.message === 'string' ? body.message : '';

    if (response.status === 422) {
      throw new InvalidIntakeOutputError();
    }

    if (!response.ok) {
      if (message.includes('not configured')) {
        throw new IntakeProviderError('The AI provider is not configured.');
      }

      throw new IntakeProviderError('The AI provider could not be reached.');
    }

    return body;
  }
}
