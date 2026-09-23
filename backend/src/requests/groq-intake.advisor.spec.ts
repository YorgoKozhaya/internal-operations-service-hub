import { GroqIntakeAdvisor } from './groq-intake.advisor';
import { IntakeProviderError } from './intake-advisor';
import { PRODUCT_CATEGORIES } from './intake-rules';

describe('Groq intake advisor', () => {
  const previousKey = process.env.GROQ_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.GROQ_API_KEY;
      return;
    }

    process.env.GROQ_API_KEY = previousKey;
  });

  it('fails clearly when the API key is missing', async () => {
    delete process.env.GROQ_API_KEY;
    const advisor = new GroqIntakeAdvisor();

    await expect(
      advisor.advise('My laptop keyboard stopped working.', {
        categories: PRODUCT_CATEGORIES,
        employeeRequests: [],
      }),
    ).rejects.toBeInstanceOf(IntakeProviderError);
  });
});
