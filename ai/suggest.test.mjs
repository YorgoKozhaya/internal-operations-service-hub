import assert from 'node:assert/strict';
import test from 'node:test';
import { SuggestError, suggest } from './suggest.mjs';

test('fails clearly when the API key is missing', async () => {
  const previous = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;

  try {
    await assert.rejects(
      () => suggest('My laptop keyboard stopped working.', { employeeRequests: [] }),
      (error) => error instanceof SuggestError && error.code === 'not_configured',
    );
  } finally {
    if (previous === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = previous;
    }
  }
});
