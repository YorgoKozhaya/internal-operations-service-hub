import { GroqIntakeAdvisor } from './groq-intake.advisor';
import { IntakeProviderError, InvalidIntakeOutputError } from './intake-advisor';
import { PRODUCT_CATEGORIES } from './intake-rules';

describe('AI service advisor', () => {
  const context = { categories: PRODUCT_CATEGORIES, employeeRequests: [] };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fails clearly when the AI service is not running', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'));
    const advisor = new GroqIntakeAdvisor();

    await expect(advisor.advise('My laptop keyboard stopped working.', context)).rejects.toMatchObject({
      message: 'The AI service is not running.',
    });
    await expect(advisor.advise('My laptop keyboard stopped working.', context)).rejects.toBeInstanceOf(
      IntakeProviderError,
    );
  });

  it('reports a missing key when the AI service says it is not configured', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'The AI provider is not configured.' }), { status: 503 }),
    );
    const advisor = new GroqIntakeAdvisor();

    await expect(advisor.advise('My laptop keyboard stopped working.', context)).rejects.toMatchObject({
      message: 'The AI provider is not configured.',
    });
  });

  it('rejects an invalid suggestion from the AI service', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'The AI provider returned an invalid intake result.' }), {
        status: 422,
      }),
    );
    const advisor = new GroqIntakeAdvisor();

    await expect(advisor.advise('My laptop keyboard stopped working.', context)).rejects.toBeInstanceOf(
      InvalidIntakeOutputError,
    );
  });
});
